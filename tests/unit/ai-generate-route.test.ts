import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/recipes/generate/route";
import { generateRecipe } from "@/lib/ai/generate";
import { resetServerRateLimitForTests } from "@/lib/ai/rate-limit";

vi.mock("@/lib/ai/generate", () => ({
  generateRecipe: vi.fn(async () => ({
    ok: true,
    recipe: { title: "Safe soup" },
    warnings: []
  }))
}));

function generationRequest(body: string, headers: HeadersInit = {}) {
  return new NextRequest("http://localhost/api/recipes/generate", {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      ...headers
    }
  });
}

describe("AI recipe generation route", () => {
  afterEach(() => {
    resetServerRateLimitForTests();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("requires an API key in production with a real LLM provider", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LLM_PROVIDER", "openai");

    const response = await POST(generationRequest("{}"));

    expect(response.status).toBe(503);
    expect(generateRecipe).not.toHaveBeenCalled();
  });

  it("rejects invalid generation keys before generation", async () => {
    vi.stubEnv("AI_GENERATION_API_KEY", "expected-secret");

    const response = await POST(generationRequest("{}", { authorization: "Bearer wrong-secret" }));

    expect(response.status).toBe(401);
    expect(generateRecipe).not.toHaveBeenCalled();
  });

  it("rate limits repeated invalid generation keys", async () => {
    vi.stubEnv("AI_GENERATION_API_KEY", "expected-secret");

    for (let index = 0; index < 20; index += 1) {
      const response = await POST(generationRequest("{}", { authorization: "Bearer wrong-secret" }));
      expect(response.status).toBe(401);
    }

    const response = await POST(generationRequest("{}", { authorization: "Bearer wrong-secret" }));

    expect(response.status).toBe(429);
    expect(generateRecipe).not.toHaveBeenCalled();
  });

  it("rejects oversized bodies before JSON parsing or generation", async () => {
    vi.stubEnv("AI_GENERATION_API_KEY", "expected-secret");
    vi.stubEnv("AI_MAX_REQUEST_BODY_BYTES", "32");

    const response = await POST(generationRequest("x".repeat(64), { authorization: "Bearer expected-secret" }));

    expect(response.status).toBe(413);
    expect(generateRecipe).not.toHaveBeenCalled();
  });

  it("passes authorized bounded JSON to the generator", async () => {
    vi.stubEnv("AI_GENERATION_API_KEY", "expected-secret");

    const response = await POST(generationRequest('{"mainIngredient":"salmon"}', { "x-ai-generation-key": "expected-secret" }));

    expect(response.status).toBe(200);
    expect(generateRecipe).toHaveBeenCalledWith({ mainIngredient: "salmon" });
  });
});
