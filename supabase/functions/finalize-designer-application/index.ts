import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_SHOWCASE = [
  "ladies_clothes",
  "mens_clothes",
  "bags",
  "shoes",
] as const;

type ShowcaseCategory = (typeof ALLOWED_SHOWCASE)[number];

function getAdminKey(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;

  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!raw) throw new Error("Supabase server secret is missing.");

  const parsed = JSON.parse(raw);
  const key = parsed.default || Object.values(parsed)[0];
  if (!key) throw new Error("Supabase server secret is missing.");

  return String(key);
}

function allowedOrigins(): string[] {
  const configured = Deno.env.get("APP_ALLOWED_ORIGINS");

  return (
    configured ||
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173"
  )
    .split(",")
    .map((value: string) => value.trim())
    .filter(Boolean);
}

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const origins = allowedOrigins();
  const allowOrigin = origin && origins.includes(origin) ? origin : origins[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
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

function normalizeKenyanPhone(value: string): string {
  const digits = value.replace(/\D/g, "");

  if (/^07\d{8}$/.test(digits)) return digits;
  if (/^01\d{8}$/.test(digits)) return digits;

  if (/^7\d{8}$/.test(digits)) return `0${digits}`;
  if (/^1\d{8}$/.test(digits)) return `0${digits}`;

  if (/^2547\d{8}$/.test(digits)) return `0${digits.slice(3)}`;
  if (/^2541\d{8}$/.test(digits)) return `0${digits.slice(3)}`;

  throw new Error("Enter a valid Kenyan Safaricom number.");
}

function normalizeShowcase(value: unknown): ShowcaseCategory[] {
  if (!Array.isArray(value)) {
    throw new Error("Please select at least one showcase category.");
  }

  const unique = [...new Set(value.map((item) => String(item)))] as string[];

  if (unique.length === 0) {
    throw new Error("Please select at least one showcase category.");
  }

  for (const item of unique) {
    if (!ALLOWED_SHOWCASE.includes(item as ShowcaseCategory)) {
      throw new Error("One or more selected showcase categories are invalid.");
    }
  }

  // Keep the database serial/category order stable.
  return ALLOWED_SHOWCASE.filter((item) => unique.includes(item));
}

function calculateDesignerFee(showcase: ShowcaseCategory[]): number {
  const hasClothing =
    showcase.includes("ladies_clothes") ||
    showcase.includes("mens_clothes");

  return (
    (hasClothing ? 10000 : 0) +
    (showcase.includes("bags") ? 10000 : 0) +
    (showcase.includes("shoes") ? 7500 : 0)
  );
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

Deno.serve(async (req: Request) => {
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
    const body = await req.json();

    const externalReference = String(body?.externalReference || "").trim();
    const brandName = String(body?.brandName || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const phone = normalizeKenyanPhone(String(body?.phone || ""));
    const location = String(body?.location || "").trim();
    const showcase = normalizeShowcase(body?.showcase);
    const expectedFee = calculateDesignerFee(showcase);

    if (!externalReference) {
      throw new Error("Payment reference is missing.");
    }

    if (!brandName) {
      throw new Error("Brand name is required.");
    }

    if (!email || !validEmail(email)) {
      throw new Error("Enter a valid email address.");
    }

    if (!location) {
      throw new Error("Location is required.");
    }

    if (expectedFee <= 0) {
      throw new Error("The selected showcase categories do not have a valid fee.");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) {
      throw new Error("SUPABASE_URL is missing.");
    }

    const supabase = createClient(supabaseUrl, getAdminKey());

    // Idempotency: if this paid application was already finalized, return it.
    const { data: existingApplication, error: existingError } = await supabase
      .from("designer_applications")
      .select("id, designer_serial, external_reference")
      .eq("external_reference", externalReference)
      .maybeSingle();

    if (existingError) {
      throw new Error(`Could not check existing designer registration: ${existingError.message}`);
    }

    if (existingApplication) {
      return json(req, {
        success: true,
        alreadyFinalized: true,
        applicationId: existingApplication.id,
        designerSerial: existingApplication.designer_serial,
        externalReference: existingApplication.external_reference,
        message: "Designer registration was already submitted successfully.",
      });
    }

    // Verify payment BEFORE inserting any personal designer information.
    const { data: receipt, error: receiptError } = await supabase
      .from("payment_receipts")
      .select(
        "external_reference, payment_purpose, payment_status, amount_expected, amount_paid, payhero_reference, mpesa_reference, paid_at"
      )
      .eq("external_reference", externalReference)
      .maybeSingle();

    if (receiptError) {
      throw new Error(`Could not verify payment: ${receiptError.message}`);
    }

    if (!receipt) {
      return json(req, { error: "No payment record was found for this registration." }, 404);
    }

    if (receipt.payment_purpose !== "designer") {
      return json(req, { error: "This payment does not belong to a designer registration." }, 400);
    }

    if (receipt.payment_status !== "paid") {
      return json(req, { error: "Payment has not been confirmed yet." }, 409);
    }

    if (Number(receipt.amount_expected) !== expectedFee) {
      return json(
        req,
        { error: "The payment amount does not match the selected showcase categories." },
        409
      );
    }

    if (Number(receipt.amount_paid) !== expectedFee) {
      return json(
        req,
        { error: "The confirmed M-Pesa amount does not match the required showcase fee." },
        409
      );
    }

    // The browser's preview serialNumber is intentionally ignored.
    // PostgreSQL generates the official serial through trg_02_set_designer_serial.
    const { data: application, error: insertError } = await supabase
      .from("designer_applications")
      .insert({
        brand_name: brandName,
        email,
        phone,
        location,
        showcase,
        amount_paid: expectedFee,
        payment_status: "paid",
        external_reference: externalReference,
        paid_at: receipt.paid_at || new Date().toISOString(),
      })
      .select("id, designer_serial, external_reference, amount_paid, created_at")
      .single();

    if (insertError) {
      // Handle a rare double-finalization race safely.
      if (insertError.code === "23505") {
        const { data: duplicate } = await supabase
          .from("designer_applications")
          .select("id, designer_serial, external_reference, amount_paid, created_at")
          .eq("external_reference", externalReference)
          .maybeSingle();

        if (duplicate) {
          return json(req, {
            success: true,
            alreadyFinalized: true,
            applicationId: duplicate.id,
            designerSerial: duplicate.designer_serial,
            externalReference: duplicate.external_reference,
            amountPaid: duplicate.amount_paid,
            message: "Designer registration was already submitted successfully.",
          });
        }
      }

      throw new Error(`Could not save designer registration: ${insertError.message}`);
    }

    return json(req, {
      success: true,
      applicationId: application.id,
      designerSerial: application.designer_serial,
      externalReference: application.external_reference,
      amountPaid: application.amount_paid,
      message: "Payment confirmed. Designer registration submitted successfully.",
    });
  } catch (error) {
    console.error("finalize-designer-application error", error);

    return json(
      req,
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to finalize designer registration.",
      },
      500
    );
  }
});
