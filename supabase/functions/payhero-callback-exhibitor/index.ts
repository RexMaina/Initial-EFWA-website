import { createClient } from "npm:@supabase/supabase-js@2";

const EXHIBITOR_FEE = 5000;

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

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const expectedToken = Deno.env.get("PAYHERO_CALLBACK_SECRET");
  const receivedToken = new URL(req.url).searchParams.get("token");

  if (!expectedToken || receivedToken !== expectedToken) {
    console.log("Exhibitor PayHero callback rejected: token mismatch");
    return Response.json({ received: false }, { status: 401 });
  }

  try {
    const payload = await req.json();

    // TEMPORARY DEBUG LOGGING - remove once the exhibitor flow is confirmed working.
    console.log("Exhibitor PayHero callback received", JSON.stringify(payload));

    // PayHero's callback data is nested under "response".
    // Match the payment_receipts row using CheckoutRequestID.
    const response = payload?.response || {};
    const checkoutRequestId = String(response?.CheckoutRequestID || "").trim();

    if (!checkoutRequestId) {
      console.log("Exhibitor PayHero callback ignored: missing CheckoutRequestID");
      return Response.json({ received: true, ignored: true }, { status: 200 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) throw new Error("SUPABASE_URL is missing.");

    const supabase = createClient(supabaseUrl, getAdminKey());

    const { data: existing, error: readError } = await supabase
      .from("payment_receipts")
      .select(
        "external_reference,payment_purpose,payment_status,amount_expected,checkout_request_id"
      )
      .eq("checkout_request_id", checkoutRequestId)
      .maybeSingle();

    if (readError) throw readError;

    if (!existing) {
      console.log("Exhibitor PayHero callback ignored: no matching receipt", {
        checkoutRequestId,
      });

      return Response.json({ received: true, ignored: true }, { status: 200 });
    }

    // This callback is for exhibitor payments only.
    if (existing.payment_purpose !== "exhibitor") {
      console.log("Exhibitor PayHero callback ignored: payment purpose mismatch", {
        checkoutRequestId,
        externalReference: existing.external_reference,
        paymentPurpose: existing.payment_purpose,
      });

      return Response.json(
        { received: true, ignored: true, reason: "payment_purpose_mismatch" },
        { status: 200 }
      );
    }

    // Do not let a later duplicate/failed callback downgrade a confirmed payment.
    if (existing.payment_status === "paid") {
      console.log("Exhibitor PayHero callback skipped: already paid", {
        checkoutRequestId,
      });

      return Response.json(
        { received: true, status: "already_paid" },
        { status: 200 }
      );
    }

    const resultCode = Number(response?.ResultCode);
    const amount = Number(response?.Amount || 0);
    const mpesaReceipt = String(response?.MpesaReceiptNumber || "").trim();
    const resultDesc = String(response?.ResultDesc || "").trim();
    const expectedAmount = Number(existing.amount_expected || 0);

    const validPaidCallback =
      payload?.status === true &&
      resultCode === 0 &&
      expectedAmount === EXHIBITOR_FEE &&
      amount === EXHIBITOR_FEE;

    // TEMPORARY DEBUG LOGGING - remove once the exhibitor flow is confirmed working.
    console.log("Exhibitor PayHero callback validation", {
      checkoutRequestId,
      externalReference: existing.external_reference,
      paymentPurpose: existing.payment_purpose,
      topLevelStatus: payload?.status,
      resultCode,
      amount,
      amountExpectedInReceipt: expectedAmount,
      requiredExhibitorFee: EXHIBITOR_FEE,
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
        payment_message:
          resultDesc ||
          (validPaidCallback ? "Payment confirmed" : "Payment failed"),
        paid_at: paidAt,
        updated_at: new Date().toISOString(),
      })
      .eq("checkout_request_id", checkoutRequestId)
      .eq("payment_purpose", "exhibitor");

    if (updateError) throw updateError;

    console.log("Exhibitor PayHero callback processed", {
      externalReference: existing.external_reference,
      checkoutRequestId,
      paymentStatus,
      amount,
    });

    // PayHero expects a fast 200 acknowledgement.
    return Response.json(
      {
        received: true,
        paymentStatus,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("payhero-callback-exhibitor error", error);

    // A 500 allows a genuine provider callback to be retried if our DB write failed.
    return Response.json({ received: false }, { status: 500 });
  }
});
