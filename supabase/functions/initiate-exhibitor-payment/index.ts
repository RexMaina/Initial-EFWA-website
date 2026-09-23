import { createClient } from "npm:@supabase/supabase-js@2";

const EXHIBITOR_FEE = 5000;
const PAYHERO_PAYMENT_URL = "https://backend.payhero.co.ke/api/v2/payments";

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

  throw new Error(
    "Enter a valid Kenyan Safaricom number, for example 0712345678, 0112345678, +254712345678, or +254112345678."
  );
}

function generateExternalReference(): string {
  // 12 characters total for safe M-Pesa AccountReference compatibility.
  const timestampPart = Date.now()
    .toString(36)
    .toUpperCase()
    .slice(-8)
    .padStart(8, "0");

  const randomPart = Math.random()
    .toString(36)
    .toUpperCase()
    .slice(2, 4)
    .padEnd(2, "0");

  return `EX${timestampPart}${randomPart}`;
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
    const phoneNumber = normalizeKenyanPhone(String(body?.phone || ""));

    const apiUsername = Deno.env.get("PAYHERO_API_USERNAME");
    const apiPassword = Deno.env.get("PAYHERO_API_PASSWORD");
    const channelId = Number(Deno.env.get("PAYHERO_CHANNEL_ID"));
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const callbackSecret = Deno.env.get("PAYHERO_CALLBACK_SECRET");

    if (!apiUsername || !apiPassword) {
      throw new Error("PayHero API credentials are not configured.");
    }

    if (!Number.isFinite(channelId) || channelId <= 0) {
      throw new Error("PayHero channel configuration is invalid.");
    }

    if (!supabaseUrl) {
      throw new Error("SUPABASE_URL is missing.");
    }

    if (!callbackSecret) {
      throw new Error("PAYHERO_CALLBACK_SECRET is not configured.");
    }

    const supabase = createClient(supabaseUrl, getAdminKey());
    const externalReference = generateExternalReference();

    // IMPORTANT:
    // Before payment, store ONLY payment metadata.
    // Brand name, product type, email and location are NOT stored here.
    const { error: receiptError } = await supabase
      .from("payment_receipts")
      .insert({
        external_reference: externalReference,
        payment_purpose: "exhibitor",
        payment_status: "pending",
        amount_expected: EXHIBITOR_FEE,
        payment_message: "Exhibitor payment initiated",
      });

    if (receiptError) {
      throw new Error(`Could not create payment record: ${receiptError.message}`);
    }

    const callbackUrl = `${supabaseUrl}/functions/v1/payhero-callback-exhibitor?token=${encodeURIComponent(
      callbackSecret
    )}`;

    const auth = btoa(`${apiUsername}:${apiPassword}`);

    const requestBody = {
      amount: EXHIBITOR_FEE,
      phone_number: phoneNumber,
      provider: "m-pesa",
      channel_id: channelId,
      external_reference: externalReference,
      callback_url: callbackUrl,
    };

    console.log("Exhibitor PayHero request", {
      amount: EXHIBITOR_FEE,
      phone_number: phoneNumber,
      channel_id: channelId,
      external_reference: externalReference,
    });

    const payheroResponse = await fetch(PAYHERO_PAYMENT_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        "Accept-Encoding": "identity",
      },
      body: JSON.stringify(requestBody),
    });

    const rawBody = await payheroResponse.text();

    let payheroData: Record<string, any> = {};
    try {
      payheroData = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      console.log("PayHero response was not valid JSON");
    }

    console.log("Exhibitor PayHero response", {
      status: payheroResponse.status,
      response: payheroData,
    });

    if (!payheroResponse.ok) {
      const message =
        payheroData?.error_message ||
        payheroData?.message ||
        "PayHero rejected the payment request.";

      await supabase
        .from("payment_receipts")
        .update({
          payment_status: "failed",
          payment_message: String(message),
          updated_at: new Date().toISOString(),
        })
        .eq("external_reference", externalReference);

      return json(req, { error: String(message) }, payheroResponse.status);
    }

    const payheroReference = payheroData?.reference || null;
    const checkoutRequestId =
      payheroData?.CheckoutRequestID || payheroData?.checkout_request_id || null;

    const { error: receiptUpdateError } = await supabase
      .from("payment_receipts")
      .update({
        payhero_reference: payheroReference,
        checkout_request_id: checkoutRequestId,
        payment_message: payheroData?.status || "QUEUED",
        updated_at: new Date().toISOString(),
      })
      .eq("external_reference", externalReference);

    if (receiptUpdateError) {
      console.error("Exhibitor payment receipt update error", receiptUpdateError);
      // PayHero already accepted the request. Do not ask the user to retry,
      // because that could create a duplicate STK Push.
    }

    return json(
      req,
      {
        success: true,
        status: "pending",
        externalReference,
        amount: EXHIBITOR_FEE,
        payheroReference,
        checkoutRequestId,
        message: "M-Pesa request sent.",
      },
      200
    );
  } catch (error) {
    console.error("initiate-exhibitor-payment error", error);

    return json(
      req,
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to initiate exhibitor payment.",
      },
      500
    );
  }
});
