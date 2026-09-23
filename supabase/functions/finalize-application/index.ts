import { createClient } from "npm:@supabase/supabase-js@2";

const APPLICATION_FEE = 1000;
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function getAdminKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;

  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!raw) throw new Error("Supabase server secret is missing.");

  const parsed = JSON.parse(raw);
  const key = parsed.default || Object.values(parsed)[0];
  if (!key) throw new Error("Supabase server secret is missing.");
  return String(key);
}

function allowedOrigins() {
  const configured = Deno.env.get("APP_ALLOWED_ORIGINS");
  return (configured || "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const origins = allowedOrigins();
  const allowOrigin = origin && origins.includes(origin) ? origin : origins[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json",
    },
  });
}

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function extensionFor(file: File) {
  const byType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  return byType[file.type] || "jpg";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return json(req, { error: "Method not allowed." }, 405);
  }

  const origin = req.headers.get("origin");
  if (origin && !allowedOrigins().includes(origin)) {
    return json(req, { error: "Origin not allowed." }, 403);
  }

  try {
    const form = await req.formData();

    const externalReference = clean(form.get("externalReference"));
    const fullName = clean(form.get("fullName"));
    const phone = clean(form.get("phone"));
    const email = clean(form.get("email"));
    const gender = clean(form.get("gender"));
    const location = clean(form.get("location"));
    const age = Number(clean(form.get("age")));
    const height = Number(clean(form.get("height")));
    const photo = form.get("photo");

    if (
      !externalReference ||
      !fullName ||
      !phone ||
      !email ||
      !gender ||
      !location ||
      !Number.isFinite(age) ||
      !Number.isFinite(height)
    ) {
      return json(req, { error: "All application fields are required." }, 400);
    }

    if (!(photo instanceof File)) {
      return json(req, { error: "A model photo is required." }, 400);
    }

    if (!ALLOWED_PHOTO_TYPES.has(photo.type)) {
      return json(req, { error: "Photo must be JPG, PNG, or WebP." }, 400);
    }

    if (photo.size > MAX_PHOTO_SIZE) {
      return json(req, { error: "Photo must be 5MB or smaller." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) throw new Error("SUPABASE_URL is missing.");

    const supabase = createClient(supabaseUrl, getAdminKey());

    const { data: receipt, error: receiptError } = await supabase
      .from("payment_receipts")
      .select(
        "external_reference,payment_status,amount_paid,payhero_reference,mpesa_reference,paid_at,application_id,application_submitted_at"
      )
      .eq("external_reference", externalReference)
      .maybeSingle();

    if (receiptError) throw receiptError;

    if (!receipt) {
      return json(req, { error: "Payment record was not found." }, 404);
    }

    if (
      receipt.payment_status !== "paid" ||
      Number(receipt.amount_paid) !== APPLICATION_FEE
    ) {
      return json(req, { error: "A confirmed KSh 1,000 payment is required." }, 402);
    }

    if (receipt.application_submitted_at || receipt.application_id) {
      return json(req, {
        success: true,
        alreadySubmitted: true,
        message: "This paid application has already been submitted.",
      });
    }

    const filePath = `applications/${externalReference}/${crypto.randomUUID()}.${extensionFor(photo)}`;
    const fileBuffer = await photo.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("model-photos")
      .upload(filePath, fileBuffer, {
        contentType: photo.type,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Photo upload failed: ${uploadError.message}`);
    }

    const { data: application, error: insertError } = await supabase
      .from("model_applications")
      .insert({
        full_name: fullName,
        phone,
        email,
        age,
        gender,
        current_location: location,
        height_cm: height,
        photo_path: filePath,
        payment_status: "paid",
        amount_paid: receipt.amount_paid,
        payhero_reference: receipt.payhero_reference,
        mpesa_reference: receipt.mpesa_reference,
        external_reference: externalReference,
        paid_at: receipt.paid_at,
        status: "new",
      })
      .select("id")
      .single();

    if (insertError) {
      // Prevent orphaned private files when the application insert fails.
      await supabase.storage.from("model-photos").remove([filePath]);

      if (insertError.code === "23505") {
        return json(req, {
          success: true,
          alreadySubmitted: true,
          message: "This paid application has already been submitted.",
        });
      }

      throw insertError;
    }

    const { error: receiptUpdateError } = await supabase
      .from("payment_receipts")
      .update({
        application_id: application.id,
        application_submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("external_reference", externalReference);

    if (receiptUpdateError) {
      console.error("Receipt finalization warning", receiptUpdateError);
    }

    return json(req, {
      success: true,
      applicationId: application.id,
      message: "Payment confirmed. Application submitted successfully.",
    });
  } catch (error) {
    console.error("finalize-application error", error);
    return json(
      req,
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to finalize the application.",
      },
      500
    );
  }
});
