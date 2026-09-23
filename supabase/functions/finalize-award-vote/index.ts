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

function allowedOrigins() {
  const configured =
    Deno.env.get("APP_ALLOWED_ORIGINS");

  return (
    configured ||
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173"
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function corsHeaders(req: Request) {
  const origin =
    req.headers.get("origin") || "";

  const origins =
    allowedOrigins();

  const allowOrigin =
    origin && origins.includes(origin)
      ? origin
      : origins[0];

  return {
    "Access-Control-Allow-Origin":
      allowOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods":
      "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(
  req: Request,
  body: unknown,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders(req),
        "Content-Type":
          "application/json",
      },
    }
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(
      "ok",
      {
        headers: corsHeaders(req),
      }
    );
  }

  if (req.method !== "POST") {
    return json(
      req,
      { error: "Method not allowed." },
      405
    );
  }

  const origin =
    req.headers.get("origin");

  if (
    origin &&
    !allowedOrigins().includes(origin)
  ) {
    return json(
      req,
      { error: "Origin not allowed." },
      403
    );
  }

  try {
    const body =
      await req.json();

    const externalReference =
      String(
        body?.externalReference || ""
      ).trim();

    if (!externalReference) {
      return json(
        req,
        {
          error:
            "Payment reference is required.",
        },
        400
      );
    }

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");

    if (!supabaseUrl) {
      throw new Error(
        "SUPABASE_URL is missing."
      );
    }

    const supabase =
      createClient(
        supabaseUrl,
        getAdminKey()
      );

    // ---------------------------------------------------------
    // IF THIS PAYMENT WAS ALREADY FINALIZED,
    // RETURN SUCCESS WITHOUT ADDING ANOTHER VOTE.
    // ---------------------------------------------------------

    const {
      data: existingVote,
      error: existingVoteError,
    } = await supabase
      .from("award_votes")
      .select(
        "id, contestant_id, external_reference"
      )
      .eq(
        "external_reference",
        externalReference
      )
      .maybeSingle();

    if (existingVoteError) {
      throw existingVoteError;
    }

    if (existingVote) {
      const {
        data: existingContestant,
        error: contestantReadError,
      } = await supabase
        .from("award_contestants")
        .select(
          "id, contestant_name, award_category, vote_count"
        )
        .eq(
          "id",
          existingVote.contestant_id
        )
        .single();

      if (contestantReadError) {
        throw contestantReadError;
      }

      return json(
        req,
        {
          success: true,
          alreadyFinalized: true,
          contestant:
            existingContestant,
          message:
            "This paid vote was already counted.",
        },
        200
      );
    }

    // ---------------------------------------------------------
    // READ THE PAYMENT RECEIPT.
    // The receipt determines which contestant receives the vote.
    // ---------------------------------------------------------

    const {
      data: receipt,
      error: receiptError,
    } = await supabase
      .from("payment_receipts")
      .select(`
        external_reference,
        payment_purpose,
        payment_status,
        amount_expected,
        amount_paid,
        vote_contestant_id,
        payhero_reference,
        mpesa_reference,
        paid_at
      `)
      .eq(
        "external_reference",
        externalReference
      )
      .maybeSingle();

    if (receiptError) {
      throw receiptError;
    }

    if (!receipt) {
      return json(
        req,
        {
          error:
            "Payment receipt was not found.",
        },
        404
      );
    }

    if (
      receipt.payment_purpose !==
      "award_vote"
    ) {
      return json(
        req,
        {
          error:
            "This payment reference is not for an award vote.",
        },
        400
      );
    }

    if (
      receipt.payment_status !==
      "paid"
    ) {
      return json(
        req,
        {
          error:
            "Payment has not been confirmed yet.",
          status:
            receipt.payment_status,
        },
        409
      );
    }

    if (
      Number(receipt.amount_expected) !==
      VOTE_FEE
    ) {
      return json(
        req,
        {
          error:
            "The expected vote payment amount is invalid.",
        },
        400
      );
    }

    if (
      Number(receipt.amount_paid) !==
      VOTE_FEE
    ) {
      return json(
        req,
        {
          error:
            "The confirmed payment amount does not match the KSh 10 voting fee.",
        },
        400
      );
    }

    if (!receipt.vote_contestant_id) {
      return json(
        req,
        {
          error:
            "No contestant is linked to this payment.",
        },
        400
      );
    }

    // ---------------------------------------------------------
    // VERIFY CONTESTANT IS STILL VALID/ACTIVE.
    // ---------------------------------------------------------

    const {
      data: contestant,
      error: contestantError,
    } = await supabase
      .from("award_contestants")
      .select(
        "id, contestant_name, award_category, vote_count, is_active"
      )
      .eq(
        "id",
        receipt.vote_contestant_id
      )
      .maybeSingle();

    if (contestantError) {
      throw contestantError;
    }

    if (!contestant) {
      return json(
        req,
        {
          error:
            "The selected contestant no longer exists.",
        },
        404
      );
    }

    if (
      contestant.is_active !== true
    ) {
      return json(
        req,
        {
          error:
            "Voting is no longer active for this contestant.",
        },
        400
      );
    }

    // ---------------------------------------------------------
    // INSERT ONE PAID VOTE.
    //
    // The DB trigger validates the receipt again and then
    // increments award_contestants.vote_count atomically.
    // ---------------------------------------------------------

    const {
      error: insertError,
    } = await supabase
      .from("award_votes")
      .insert({
        contestant_id:
          receipt.vote_contestant_id,
        external_reference:
          receipt.external_reference,
        amount_paid:
          Number(receipt.amount_paid),
        payment_status:
          "paid",
        payhero_reference:
          receipt.payhero_reference ||
          null,
        mpesa_reference:
          receipt.mpesa_reference ||
          null,
        paid_at:
          receipt.paid_at ||
          new Date().toISOString(),
      });

    if (insertError) {
      // A duplicate external reference means another request
      // finalized the exact same payment first. Treat it as
      // already finalized rather than creating a second vote.
      if (
        insertError.code === "23505"
      ) {
        const {
          data: duplicateVote,
          error: duplicateReadError,
        } = await supabase
          .from("award_votes")
          .select(
            "contestant_id"
          )
          .eq(
            "external_reference",
            externalReference
          )
          .single();

        if (duplicateReadError) {
          throw duplicateReadError;
        }

        const {
          data: duplicateContestant,
          error: duplicateContestantError,
        } = await supabase
          .from("award_contestants")
          .select(
            "id, contestant_name, award_category, vote_count"
          )
          .eq(
            "id",
            duplicateVote.contestant_id
          )
          .single();

        if (duplicateContestantError) {
          throw duplicateContestantError;
        }

        return json(
          req,
          {
            success: true,
            alreadyFinalized: true,
            contestant:
              duplicateContestant,
            message:
              "This paid vote was already counted.",
          },
          200
        );
      }

      throw insertError;
    }

    // ---------------------------------------------------------
    // READ UPDATED COUNT AFTER THE DATABASE TRIGGER RAN.
    // ---------------------------------------------------------

    const {
      data: updatedContestant,
      error: updatedContestantError,
    } = await supabase
      .from("award_contestants")
      .select(
        "id, contestant_name, award_category, vote_count"
      )
      .eq(
        "id",
        receipt.vote_contestant_id
      )
      .single();

    if (updatedContestantError) {
      throw updatedContestantError;
    }

    console.log(
      "Award vote finalized",
      {
        externalReference,
        contestantId:
          updatedContestant.id,
        contestantName:
          updatedContestant.contestant_name,
        voteCount:
          updatedContestant.vote_count,
      }
    );

    return json(
      req,
      {
        success: true,
        alreadyFinalized: false,
        contestant:
          updatedContestant,
        message:
          "Payment confirmed. Your vote has been counted.",
      },
      200
    );
  } catch (error) {
    console.error(
      "finalize-award-vote error",
      error
    );

    return json(
      req,
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to finalize the vote.",
      },
      500
    );
  }
});
