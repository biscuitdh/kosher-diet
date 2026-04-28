import { createHash, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { generateRecipe } from "@/lib/ai/generate";
import { checkServerRateLimit } from "@/lib/ai/rate-limit";

export const runtime = "nodejs";

const DEFAULT_MAX_BODY_BYTES = 64 * 1024;
const IP_HEADER_PATTERN = /^[a-z0-9:.,\-\s[\]]{1,160}$/i;

function truthyEnv(value: string | undefined) {
  return value === "1" || value?.toLowerCase() === "true" || value?.toLowerCase() === "yes";
}

function configuredProvider() {
  return (process.env.LLM_PROVIDER || (process.env.NODE_ENV === "production" ? "openai" : "mock")).toLowerCase();
}

function positiveIntegerFromEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function maxBodyBytes() {
  return positiveIntegerFromEnv("AI_MAX_REQUEST_BODY_BYTES", DEFAULT_MAX_BODY_BYTES);
}

function normalizeHeaderValue(value: string | null) {
  const trimmed = value?.split(",")[0]?.trim();
  return trimmed && IP_HEADER_PATTERN.test(trimmed) ? trimmed : undefined;
}

function getClientKey(request: NextRequest) {
  if (truthyEnv(process.env.AI_RATE_LIMIT_TRUST_PROXY_HEADERS)) {
    const forwarded = normalizeHeaderValue(request.headers.get("x-forwarded-for"));
    const realIp = normalizeHeaderValue(request.headers.get("x-real-ip"));
    return `ip:${forwarded || realIp || "unknown"}`;
  }

  return "anonymous";
}

function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest();
}

function timingSafeEqualString(actual: string, expected: string) {
  return timingSafeEqual(hashSecret(actual), hashSecret(expected));
}

function requestGenerationKey(request: NextRequest) {
  const authorization = request.headers.get("authorization")?.trim();
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice("bearer ".length).trim();
  }
  return request.headers.get("x-ai-generation-key")?.trim() || "";
}

function authorizeAiGeneration(request: NextRequest) {
  const generationKey = process.env.AI_GENERATION_API_KEY?.trim();
  if (generationKey) {
    const suppliedKey = requestGenerationKey(request);
    if (suppliedKey && timingSafeEqualString(suppliedKey, generationKey)) return undefined;

    return NextResponse.json(
      { error: "AI generation is not authorized.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  if (process.env.NODE_ENV === "production" && configuredProvider() !== "mock") {
    return NextResponse.json(
      { error: "AI generation is disabled until AI_GENERATION_API_KEY is configured.", code: "AI_GENERATION_DISABLED" },
      { status: 503 }
    );
  }

  return undefined;
}

function rateLimitResponse(rateLimit: ReturnType<typeof checkServerRateLimit>) {
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

function failedAuthRateLimitResponse(request: NextRequest) {
  const rateLimit = checkServerRateLimit(`auth:${getClientKey(request)}`);
  return rateLimit.allowed ? undefined : rateLimitResponse(rateLimit);
}

function bodyTooLargeResponse() {
  return NextResponse.json(
    { error: "Recipe request body is too large.", code: "BODY_TOO_LARGE" },
    { status: 413 }
  );
}

function badJsonResponse() {
  return NextResponse.json({ error: "Invalid JSON request body.", code: "BAD_JSON" }, { status: 400 });
}

function contentLengthExceedsLimit(request: NextRequest, limit: number) {
  const contentLength = request.headers.get("content-length");
  if (!contentLength) return false;
  const parsed = Number(contentLength);
  return Number.isFinite(parsed) && parsed > limit;
}

async function readBoundedJson(request: NextRequest) {
  const limit = maxBodyBytes();
  if (contentLengthExceedsLimit(request, limit)) {
    return { ok: false as const, response: bodyTooLargeResponse() };
  }

  if (!request.body) return { ok: false as const, response: badJsonResponse() };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    receivedBytes += value.byteLength;
    if (receivedBytes > limit) {
      await reader.cancel().catch(() => undefined);
      return { ok: false as const, response: bodyTooLargeResponse() };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { ok: true as const, body: JSON.parse(new TextDecoder().decode(bytes)) as unknown };
  } catch {
    return { ok: false as const, response: badJsonResponse() };
  }
}

export async function POST(request: NextRequest) {
  const unauthorizedResponse = authorizeAiGeneration(request);
  if (unauthorizedResponse) {
    return failedAuthRateLimitResponse(request) ?? unauthorizedResponse;
  }

  const rateLimit = checkServerRateLimit(getClientKey(request));
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit);
  }

  const parsedBody = await readBoundedJson(request);
  if (!parsedBody.ok) return parsedBody.response;

  const result = await generateRecipe(parsedBody.body);
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
