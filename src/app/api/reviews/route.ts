import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

interface ScoreDetail {
  score: number;
  reason: string;
}

interface SuggestionItem {
  original: string;
  improved: string;
  rule: string;
}

interface ResultCardPayload {
  topic?: string;
  transcript?: string;
  scores?: {
    FC?: ScoreDetail;
    LR?: ScoreDetail;
    GRA?: ScoreDetail;
    P?: ScoreDetail;
  };
  overallScore?: number;
  suggestions?: SuggestionItem[];
  highlights?: string[];
  examinerClosing?: string;
}

interface ReviewRequestBody {
  userName?: string;
  examinerName?: string;
  resultCard?: ResultCardPayload;
  user_name?: string;
  examiner_name?: string;
  topic?: string;
  transcript?: string;
  scores?: {
    FC?: ScoreDetail;
    LR?: ScoreDetail;
    GRA?: ScoreDetail;
    P?: ScoreDetail;
  };
  overall_score?: number;
  suggestions?: SuggestionItem[];
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function getMissingEnvKeys() {
  return [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ].filter((key) => !process.env[key]);
}

function normalizeReviewPayload(body: ReviewRequestBody) {
  const resultCard = body.resultCard;

  return {
    user_name: body.userName?.trim() || body.user_name?.trim() || "",
    examiner_name: body.examinerName?.trim() || body.examiner_name?.trim() || "",
    topic: resultCard?.topic?.trim() || body.topic?.trim() || "",
    transcript: resultCard?.transcript?.trim() || body.transcript?.trim() || "",
    scores: resultCard?.scores ?? body.scores ?? {},
    overall_score: resultCard?.overallScore ?? body.overall_score,
    suggestions: resultCard?.suggestions ?? body.suggestions ?? [],
  };
}

export async function POST(req: NextRequest) {
  const missingEnvKeys = getMissingEnvKeys();

  if (missingEnvKeys.length > 0) {
    return json(
      {
        code: "MISSING_SUPABASE_ENV",
        error: `Missing Supabase environment variables: ${missingEnvKeys.join(", ")}`,
      },
      500
    );
  }

  let body: ReviewRequestBody;

  try {
    body = await req.json();
  } catch {
    return json({ code: "INVALID_JSON_BODY", error: "Invalid JSON body" }, 400);
  }

  const payload = normalizeReviewPayload(body);

  if (
    !payload.user_name ||
    !payload.examiner_name ||
    !payload.topic ||
    typeof payload.overall_score !== "number"
  ) {
    return json(
      {
        code: "INVALID_REVIEW_PAYLOAD",
        error:
          "userName, examinerName, resultCard.topic, and resultCard.overallScore are required",
      },
      400
    );
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("user_reviews")
      .insert({
        user_name: payload.user_name,
        examiner_name: payload.examiner_name,
        topic: payload.topic,
        transcript: payload.transcript,
        scores: payload.scores,
        overall_score: payload.overall_score,
        suggestions: payload.suggestions,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      console.error("[reviews] insert error:", error);
      return json(
        {
          code: error.code ?? "SUPABASE_INSERT_FAILED",
          error: error.message,
        },
        500
      );
    }

    return json({ success: true, reviewId: data.id }, 201);
  } catch (error) {
    console.error("[reviews] unexpected error:", error);
    return json(
      {
        code: "REVIEW_SAVE_UNEXPECTED_ERROR",
        error: "Unexpected review save error",
      },
      500
    );
  }
}
