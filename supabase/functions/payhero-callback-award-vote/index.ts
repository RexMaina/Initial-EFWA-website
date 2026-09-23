import { createClient } from "npm:@supabase/supabase-js@2";

const VOTE_FEE = 10;

function getAdminKey() {
  const legacy =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (legacy) return legacy;

  const raw =
    Deno.env.get("SUPABASE_SECRET_KEYS");

  if (!raw) {
    throw new Error(
      "Supabase server secret is missing."
    );
  }

  const parsed = JSON.parse(raw);

  const key =
    parsed.default ||
    Object.values(parsed)[0];

  if (!key) {
    throw new Error(
      "Supabase server secret is missing."
    );
  }

  return String(key);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(
      "Method not allowed",
      { status: 405 }
    );
  }

  const expectedToken =
    Deno.env.get("PAYHERO_CALLBACK_SECRET");

  const receivedToken =
    new URL(req.url)
      .searchParams
      .get("token");

  if (
    !expectedToken ||
    receivedToken !== expectedToken
  ) {
    console.log(
      "Award vote callback rejected: token mismatch"
    );

    return Response.json(
      { received: false },
      { status: 401 }
    );
  }

  try {
    const payload = await req.json();

    console.log(
      "Award vote PayHero callback received",
      JSON.stringify(payload)
    );

    // PayHero callback data is nested under "response".
    // We match the receipt using CheckoutRequestID.
    const response =
      payload?.response || {};

    const checkoutRequestId =
      String(
        response?.CheckoutRequestID || ""
      );

    if (!checkoutRequestId) {
      console.log(
        "Award vote callback ignored: missing CheckoutRequestID"
      );

      return Response.json(
        {
          received: true,
          ignored: true,
        },
        { status: 200 }
      );
    }

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");

    if (!supabaseUrl) {
      throw new Error(
        "SUPABASE_URL is missing."
      );
    }

    const supabase = createClient(
      supabaseUrl,
      getAdminKey()
    );

    const {
      data: existing,
      error: readError,
    } = await supabase
      .from("payment_receipts")
      .select(`
        external_reference,
        payment_status,
        payment_purpose,
        amount_expected,
        vote_contestant_id
      `)
      .eq(
        "checkout_request_id",
        checkoutRequestId
      )
      .maybeSingle();

    if (readError) {
      throw readError;
    }

    if (!existing) {
      console.log(
        "Award vote callback ignored: no matching receipt",
        { checkoutRequestId }
      );

      return Response.json(
        {
          received: true,
          ignored: true,
        },
        { status: 200 }
      );
    }

    // This callback is only for award-vote payments.
    if (
      existing.payment_purpose !==
      "award_vote"
    ) {
      console.log(
        "Award vote callback ignored: payment purpose mismatch",
        {
          checkoutRequestId,
          paymentPurpose:
            existing.payment_purpose,
        }
      );

      return Response.json(
        {
          received: true,
          ignored: true,
        },
        { status: 200 }
      );
    }

    if (!existing.vote_contestant_id) {
      console.log(
        "Award vote callback ignored: receipt has no contestant",
        { checkoutRequestId }
      );

      return Response.json(
        {
          received: true,
          ignored: true,
        },
        { status: 200 }
      );
    }

    // Never downgrade a payment already confirmed as paid.
    if (
      existing.payment_status === "paid"
    ) {
      console.log(
        "Award vote callback skipped: already paid",
        { checkoutRequestId }
      );

      return Response.json(
        {
          received: true,
          status: "already_paid",
        },
        { status: 200 }
      );
    }

    const resultCode =
      Number(response?.ResultCode);

    const amount =
      Number(response?.Amount || 0);

    const mpesaReceipt =
      String(
        response?.MpesaReceiptNumber || ""
      );

    const resultDesc =
      String(
        response?.ResultDesc || ""
      );

    const expectedAmount =
      Number(existing.amount_expected || 0);

    const validPaidCallback =
      payload?.status === true &&
      resultCode === 0 &&
      expectedAmount === VOTE_FEE &&
      amount === expectedAmount;

    console.log(
      "Award vote callback validation",
      {
        checkoutRequestId,
        externalReference:
          existing.external_reference,
        contestantId:
          existing.vote_contestant_id,
        topLevelStatus:
          payload?.status,
        resultCode,
        amount,
        expectedAmount,
        validPaidCallback,
      }
    );

    const paymentStatus =
      validPaidCallback
        ? "paid"
        : "failed";

    const paidAt =
      validPaidCallback
        ? new Date().toISOString()
        : null;

    const { error: updateError } =
      await supabase
        .from("payment_receipts")
        .update({
          payment_status: paymentStatus,
          amount_paid:
            amount || null,
          payhero_reference:
            response?.MerchantRequestID ||
            null,
          mpesa_reference:
            mpesaReceipt || null,
          payment_message:
            resultDesc ||
            (
              validPaidCallback
                ? "Vote payment confirmed"
                : "Vote payment failed"
            ),
          paid_at: paidAt,
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "checkout_request_id",
          checkoutRequestId
        );

    if (updateError) {
      throw updateError;
    }

    console.log(
      "Award vote callback processed",
      {
        externalReference:
          existing.external_reference,
        contestantId:
          existing.vote_contestant_id,
        checkoutRequestId,
        paymentStatus,
      }
    );

    // Fast acknowledgement for PayHero.
    return Response.json(
      { received: true },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "payhero-callback-award-vote error",
      error
    );

    // 500 allows PayHero to retry if our DB write failed.
    return Response.json(
      { received: false },
      { status: 500 }
    );
  }
});
