import { createClient } from "npm:@supabase/supabase-js@2";

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
    const { externalReference } = await req.json();
    const reference = String(externalReference || "").trim();

    if (!reference) {
      return json(req, { error: "Payment reference is required." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) throw new Error("SUPABASE_URL is missing.");

    const supabase = createClient(supabaseUrl, getAdminKey());

    const { data, error } = await supabase
      .from("payment_receipts")
      .select(
        "payment_status,amount_paid,payhero_reference,mpesa_reference,payment_message,paid_at,application_submitted_at"
      )
      .eq("external_reference", reference)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return json(req, { error: "Payment reference was not found." }, 404);
    }

    return json(req, {
      status: data.payment_status,
      amountPaid: data.amount_paid,
      payheroReference: data.payhero_reference,
      mpesaReference: data.mpesa_reference,
      message: data.payment_message,
      paidAt: data.paid_at,
      applicationSubmitted: Boolean(data.application_submitted_at),
    });
  } catch (error) {
    console.error("check-payment error", error);
    return json(
      req,
      { error: error instanceof Error ? error.message : "Unable to check payment." },
      500
    );
  }
});
