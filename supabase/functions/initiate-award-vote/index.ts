import { createClient } from "npm:@supabase/supabase-js@2";

const VOTE_FEE = 10;

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

  return (
    configured ||
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173"
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const origins = allowedOrigins();

  const allowOrigin =
    origin && origins.includes(origin)
      ? origin
      : origins[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(
  req: Request,
  body: unknown,
  status = 200
) {
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
  if (/^01\d{8}$/.test(digits)) return digits;

  if (/^7\d{8}$/.test(digits)) return `0${digits}`;
  if (/^1\d{8}$/.test(digits)) return `0${digits}`;

  if (/^2547\d{8}$/.test(digits)) {
    return `0${digits.slice(3)}`;
  }

  if (/^2541\d{8}$/.test(digits)) {
    return `0${digits.slice(3)}`;
  }

  throw new Error(
    "Enter a valid Kenyan Safaricom number, for example 0712345678, 0112345678, +254712345678, or +254112345678."
  );
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function generateExternalReference() {
  // 12 alphanumeric characters, safe for M-Pesa AccountReference use.
  const random = crypto
    .randomUUID()
    .replace(/-/g, "")
    .slice(0, 10)
    .toUpperCase();

  return `EV${random}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders(req),
    });
  }

  if (req.method !== "POST") {
    return json(
      req,
      { error: "Method not allowed." },
      405
    );
  }

  const origin = req.headers.get("origin");

  if (origin && !allowedOrigins().includes(origin)) {
    return json(
      req,
      { error: "Origin not allowed." },
      403
    );
  }

  try {
    const body = await req.json();

    const phoneNumber = normalizeKenyanPhone(
      String(body?.phone || "")
    );

    const contestantId = String(
      body?.contestantId || ""
    ).trim();

    if (!contestantId || !isUuid(contestantId)) {
      return json(
        req,
        { error: "A valid contestant ID is required." },
        400
      );
    }

    const apiUsername =
      Deno.env.get("PAYHERO_API_USERNAME");

    const apiPassword =
      Deno.env.get("PAYHERO_API_PASSWORD");

    const channelId = Number(
      Deno.env.get("PAYHERO_CHANNEL_ID")
    );

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");

    const callbackSecret =
      Deno.env.get("PAYHERO_CALLBACK_SECRET");

    if (!apiUsername || !apiPassword) {
      throw new Error(
        "PayHero API credentials are not configured."
      );
    }

    if (!Number.isFinite(channelId)) {
      throw new Error(
        "PayHero channel configuration is invalid."
      );
    }

    if (!supabaseUrl) {
      throw new Error(
        "SUPABASE_URL is missing."
      );
    }

    if (!callbackSecret) {
      throw new Error(
        "PAYHERO_CALLBACK_SECRET is not configured."
      );
    }

    const supabase = createClient(
      supabaseUrl,
      getAdminKey()
    );

    // Verify that the selected contestant exists and voting is active.
    const {
      data: contestant,
      error: contestantError,
    } = await supabase
      .from("award_contestants")
      .select(
        "id, contestant_name, award_category, is_active"
      )
      .eq("id", contestantId)
      .maybeSingle();

    if (contestantError) {
      throw contestantError;
    }

    if (!contestant) {
      return json(
        req,
        { error: "The selected contestant was not found." },
        404
      );
    }

    if (contestant.is_active !== true) {
      return json(
        req,
        { error: "Voting is not active for this contestant." },
        400
      );
    }

    const externalReference =
      generateExternalReference();

    // Before payment, store only payment metadata + selected contestant.
    const { error: receiptError } = await supabase
      .from("payment_receipts")
      .insert({
        external_reference: externalReference,
        payment_purpose: "award_vote",
        vote_contestant_id: contestant.id,
        payment_status: "pending",
        amount_expected: VOTE_FEE,
        payment_message: "Award vote payment initiated",
      });

    if (receiptError) {
      throw new Error(
        `Could not create payment record: ${receiptError.message}`
      );
    }

    const callbackUrl =
      `${supabaseUrl}/functions/v1/payhero-callback-award-vote` +
      `?token=${encodeURIComponent(callbackSecret)}`;

    const auth = btoa(
      `${apiUsername}:${apiPassword}`
    );

    const requestBody = {
      amount: VOTE_FEE,
      phone_number: phoneNumber,
      provider: "m-pesa",
      channel_id: channelId,
      external_reference: externalReference,
      callback_url: callbackUrl,
    };

    console.log(
      "Award vote PayHero request",
      JSON.stringify({
        ...requestBody,
        contestant_id: contestant.id,
        contestant_name: contestant.contestant_name,
      })
    );

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

    const rawBody =
      await payheroResponse.text();

    console.log(
      "Award vote PayHero response",
      payheroResponse.status,
      rawBody
    );

    let payheroData: any = {};

    try {
      payheroData =
        rawBody
          ? JSON.parse(rawBody)
          : {};
    } catch {
      console.log(
        "PayHero response was not valid JSON"
      );
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
        .eq(
          "external_reference",
          externalReference
        );

      return json(
        req,
        { error: message },
        payheroResponse.status
      );
    }

    const checkoutRequestId =
      payheroData?.CheckoutRequestID ||
      payheroData?.checkout_request_id ||
      null;

    const payheroReference =
      payheroData?.reference ||
      null;

    const { error: updateError } =
      await supabase
        .from("payment_receipts")
        .update({
          payhero_reference: payheroReference,
          checkout_request_id: checkoutRequestId,
          payment_message:
            payheroData?.status || "QUEUED",
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "external_reference",
          externalReference
        );

    if (updateError) {
      throw new Error(
        `Payment started, but the receipt could not be updated: ${updateError.message}`
      );
    }

    return json(
      req,
      {
        success: true,
        status: "pending",
        externalReference,
        contestantId: contestant.id,
        contestantName: contestant.contestant_name,
        awardCategory: contestant.award_category,
        amount: VOTE_FEE,
        payheroReference,
        checkoutRequestId,
        message:
          "M-Pesa voting request sent.",
      },
      200
    );
  } catch (error) {
    console.error(
      "initiate-award-vote error",
      error
    );

    return json(
      req,
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to initiate voting payment.",
      },
      500
    );
  }
});
