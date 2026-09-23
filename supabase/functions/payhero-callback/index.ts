import { createClient } from "npm:@supabase/supabase-js@2";

const APPLICATION_FEE = 50;

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

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const expectedToken = Deno.env.get("PAYHERO_CALLBACK_SECRET");
  const receivedToken = new URL(req.url).searchParams.get("token");

  if (!expectedToken || receivedToken !== expectedToken) {
    console.log("PayHero callback rejected: token mismatch", { receivedToken });
    return Response.json({ received: false }, { status: 401 });
  }

  try {
    const payload = await req.json();

    // TEMPORARY DEBUG LOGGING - remove once the payment flow is confirmed working.
    console.log("PayHero callback received", JSON.stringify(payload));

    // PayHero's real callback nests everything under "response" and signals
    // success with a top-level boolean "status" plus ResultCode 0 - it does
    // NOT echo back external_reference, so we match on CheckoutRequestID instead.
    const response = payload?.response || {};
    const checkoutRequestId = String(response?.CheckoutRequestID || "");

    if (!checkoutRequestId) {
      console.log("PayHero callback ignored: missing CheckoutRequestID");
      // Acknowledge malformed callbacks so the provider does not endlessly retry.
      return Response.json({ received: true, ignored: true }, { status: 200 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) throw new Error("SUPABASE_URL is missing.");

    const supabase = createClient(supabaseUrl, getAdminKey());

    const { data: existing, error: readError } = await supabase
      .from("payment_receipts")
      .select("external_reference,payment_status")
      .eq("checkout_request_id", checkoutRequestId)
      .maybeSingle();

    if (readError) throw readError;

    if (!existing) {
      console.log("PayHero callback ignored: no matching receipt", { checkoutRequestId });
      return Response.json({ received: true, ignored: true }, { status: 200 });
    }

    // Do not let a later duplicate/failed callback downgrade a confirmed payment.
    if (existing.payment_status === "paid") {
      console.log("PayHero callback skipped: already paid", { checkoutRequestId });
      return Response.json({ received: true, status: "already_paid" }, { status: 200 });
    }

    const resultCode = Number(response?.ResultCode);
    const amount = Number(response?.Amount || 0);
    const mpesaReceipt = String(response?.MpesaReceiptNumber || "");
    const resultDesc = String(response?.ResultDesc || "");

    const validPaidCallback =
      payload?.status === true &&
      resultCode === 0 &&
      amount === APPLICATION_FEE;

    // TEMPORARY DEBUG LOGGING - remove once the payment flow is confirmed working.
    console.log("PayHero callback validation", {
      checkoutRequestId,
      topLevelStatus: payload?.status,
      resultCode,
      amount,
      expectedAmount: APPLICATION_FEE,
      validPaidCallback,
    });

    const paymentStatus = validPaidCallback ? "paid" : "failed";
    const paidAt = validPaidCallback ? new Date().toISOString() : null;

    const { error: updateError } = await supabase
      .from("payment_receipts")
      .update({
        payment_status: paymentStatus,
        amount_paid: amount || null,
        payhero_reference: response?.MerchantRequestID || null,
        mpesa_reference: mpesaReceipt || null,
        payment_message: resultDesc || (validPaidCallback ? "Payment confirmed" : "Payment failed"),
        paid_at: paidAt,
        updated_at: new Date().toISOString(),
      })
      .eq("checkout_request_id", checkoutRequestId);

    if (updateError) throw updateError;

    console.log("PayHero callback processed", {
      externalReference: existing.external_reference,
      checkoutRequestId,
      paymentStatus,
    });

    // PayHero expects a fast 200 acknowledgement.
    return Response.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("payhero-callback error", error);
    // A 500 allows a genuine provider callback to be retried if our DB write failed.
    return Response.json({ received: false }, { status: 500 });
  }
});