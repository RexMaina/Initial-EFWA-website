import { createClient } from "npm:@supabase/supabase-js@2";

const PAYHERO_PAYMENT_URL = "https://backend.payhero.co.ke/api/v2/payments";

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

  throw new Error(
    "Enter a valid Kenyan Safaricom number, for example 0712345678, 0112345678, +254712345678, or +254112345678."
  );
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

  return unique as ShowcaseCategory[];
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

function generateExternalReference(): string {
  // 12 characters total, kept short for M-Pesa AccountReference compatibility.
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

  return `DS${timestampPart}${randomPart}`;
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
    const showcase = normalizeShowcase(body?.showcase);
    const amount = calculateDesignerFee(showcase);

    if (amount <= 0) {
      throw new Error("The selected showcase categories do not have a valid fee.");
    }

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

    // IMPORTANT: No designer personal/application details are stored here.
    // Only payment metadata is created before M-Pesa confirmation.
    const { error: receiptError } = await supabase
      .from("payment_receipts")
      .insert({
        external_reference: externalReference,
        payment_purpose: "designer",
        payment_status: "pending",
        amount_expected: amount,
        payment_message: "Designer showcase payment initiated",
      });

    if (receiptError) {
      throw new Error(`Could not create payment record: ${receiptError.message}`);
    }

    const callbackUrl = `${supabaseUrl}/functions/v1/payhero-callback?token=${encodeURIComponent(
      callbackSecret
    )}`;

    const auth = btoa(`${apiUsername}:${apiPassword}`);

    const requestBody = {
      amount,
      phone_number: phoneNumber,
      provider: "m-pesa",
      channel_id: channelId,
      external_reference: externalReference,
      callback_url: callbackUrl,
    };

    // Do not log API credentials or callback secret.
    console.log("Designer PayHero request", {
      amount,
      phone_number: phoneNumber,
      channel_id: channelId,
      external_reference: externalReference,
      showcase,
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

    console.log("Designer PayHero response", {
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
      console.error("Designer payment receipt update error", receiptUpdateError);
      // PayHero has already accepted the transaction. Do not tell the customer
      // to retry, because that could create a duplicate STK Push.
    }

    return json(
      req,
      {
        success: true,
        status: "pending",
        externalReference,
        amount,
        payheroReference,
        checkoutRequestId,
        message: "M-Pesa request sent.",
      },
      200
    );
  } catch (error) {
    console.error("initiate-designer-payment error", error);

    return json(
      req,
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to initiate designer payment.",
      },
      500
    );
  }
});
