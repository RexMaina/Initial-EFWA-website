import { createClient } from "npm:@supabase/supabase-js@2";

const APPLICATION_FEE = 1000;

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

function normalizeKenyanPhone(value: string) {
  const digits = value.replace(/\D/g, "");

  if (/^07\d{8}$/.test(digits)) return digits;
  if (/^7\d{8}$/.test(digits)) return `0${digits}`;
  if (/^2547\d{8}$/.test(digits)) return `0${digits.slice(3)}`;

  throw new Error("Enter a valid Kenyan Safaricom number, for example 0712345678 or +254712345678.");
}

function generateExternalReference() {
  // PayHero's own docs allow a plain string like "INV-009" here, but this value
  // ultimately flows into M-Pesa's AccountReference field (12-char alphanumeric
  // limit), so keep it short and safe regardless of host.
  const timestampPart = Date.now().toString(36).toUpperCase().slice(-8).padStart(8, "0");
  const randomPart = Math.random().toString(36).toUpperCase().slice(2, 4).padEnd(2, "0");
  return `EF${timestampPart}${randomPart}`;
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
    const { phone } = await req.json();
    const phoneNumber = normalizeKenyanPhone(String(phone || ""));

    const apiUsername = Deno.env.get("PAYHERO_API_USERNAME");
    const apiPassword = Deno.env.get("PAYHERO_API_PASSWORD");
    const channelId = Number(Deno.env.get("PAYHERO_CHANNEL_ID"));
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const callbackSecret = Deno.env.get("PAYHERO_CALLBACK_SECRET");

    if (!apiUsername || !apiPassword) {
      throw new Error("PayHero API credentials are not configured.");
    }

    if (!Number.isFinite(channelId)) {
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

    const { error: receiptError } = await supabase
      .from("payment_receipts")
      .insert({
        external_reference: externalReference,
        payment_status: "pending",
        amount_expected: APPLICATION_FEE,
        payment_message: "Payment initiated",
      });

    if (receiptError) {
      throw new Error(`Could not create payment record: ${receiptError.message}`);
    }

    const callbackUrl = `${supabaseUrl}/functions/v1/payhero-callback?token=${encodeURIComponent(callbackSecret)}`;
    const auth = btoa(`${apiUsername}:${apiPassword}`);

    const requestBody = {
      amount: APPLICATION_FEE,
      phone_number: phoneNumber,
      provider: "m-pesa",
      channel_id: channelId,
      external_reference: externalReference,
      callback_url: callbackUrl,
    };

    // TEMPORARY DEBUG LOGGING - remove once the payment flow is confirmed working.
    console.log("PayHero request", JSON.stringify(requestBody));

    const payheroResponse = await fetch(
      "https://backend.payhero.co.ke/api/v2/payments",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
          "Accept-Encoding": "identity",
        },
        body: JSON.stringify(requestBody),
      }
    );

    const rawBody = await payheroResponse.text();

    // TEMPORARY DEBUG LOGGING - remove once the payment flow is confirmed working.
    console.log("PayHero raw response", payheroResponse.status, rawBody);

    let payheroData: any = {};
    try {
      payheroData = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      console.log("PayHero response was not valid JSON");
    }

    if (!payheroResponse.ok) {
      const message =
        payheroData?.error_message ||
        payheroData?.message ||
        "PayHero rejected the payment request.";

      await supabase
        .from("payment_receipts")
        .update({
          payment_status: "failed",
          payment_message: message,
          updated_at: new Date().toISOString(),
        })
        .eq("external_reference", externalReference);

      return json(req, { error: message }, payheroResponse.status);
    }

    await supabase
      .from("payment_receipts")
      .update({
        payhero_reference: payheroData?.reference || null,
        checkout_request_id:
          payheroData?.CheckoutRequestID || payheroData?.checkout_request_id || null,
        payment_message: payheroData?.status || "QUEUED",
        updated_at: new Date().toISOString(),
      })
      .eq("external_reference", externalReference);

    return json(
      req,
      {
        success: true,
        status: "pending",
        externalReference,
        payheroReference: payheroData?.reference || null,
        checkoutRequestId:
          payheroData?.CheckoutRequestID || payheroData?.checkout_request_id || null,
        message: "M-Pesa request sent.",
      },
      200
    );
  } catch (error) {
    console.error("initiate-payment error", error);
    return json(
      req,
      { error: error instanceof Error ? error.message : "Unable to initiate payment." },
      500
    );
  }
});