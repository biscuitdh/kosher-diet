import { NextRequest, NextResponse } from "next/server";
import { generateRecipe } from "@/lib/ai/generate";
import { checkServerRateLimit } from "@/lib/ai/rate-limit";

export const runtime = "nodejs";

function getClientKey(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "local";
}

export async function POST(request: NextRequest) {
  const rateLimit = checkServerRateLimit(getClientKey(request));
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "AI generation rate limit reached. Wait a bit before trying again.",
        code: "RATE_LIMITED"
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Remaining": String(rateLimit.remaining),
          "X-RateLimit-Reset": String(rateLimit.resetAt)
        }
      }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body.", code: "BAD_JSON" }, { status: 400 });
  }

  const result = await generateRecipe(body);
  if (!result.ok) {
    const status = result.code === "VALIDATION_ERROR" ? 400 : result.code === "UNSAFE_RECIPE" ? 422 : 502;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }

  return NextResponse.json({
    recipe: result.recipe,
    safety: {
      ok: true,
      warnings: result.warnings
    }
  });
}
