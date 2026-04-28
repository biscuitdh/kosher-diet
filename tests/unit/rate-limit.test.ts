import { afterEach, describe, expect, it, vi } from "vitest";
import { checkServerRateLimit, getServerRateLimitBucketCountForTests, resetServerRateLimitForTests } from "@/lib/ai/rate-limit";

describe("server AI rate limit", () => {
  afterEach(() => {
    resetServerRateLimitForTests();
    vi.unstubAllEnvs();
  });

  it("blocks after the hourly request limit", () => {
    for (let index = 0; index < 20; index += 1) {
      expect(checkServerRateLimit("client-a", 0).allowed).toBe(true);
    }

    expect(checkServerRateLimit("client-a", 0)).toMatchObject({
      allowed: false,
      remaining: 0
    });
  });

  it("prunes expired buckets when new clients arrive", () => {
    checkServerRateLimit("client-a", 0);
    checkServerRateLimit("client-b", 60 * 60 * 1000 + 1);

    expect(getServerRateLimitBucketCountForTests(60 * 60 * 1000 + 1)).toBe(1);
  });

  it("caps bucket growth under client-key spray", () => {
    vi.stubEnv("AI_RATE_LIMIT_MAX_BUCKETS", "3");

    for (let index = 0; index < 10; index += 1) {
      checkServerRateLimit(`client-${index}`, 0);
    }

    expect(getServerRateLimitBucketCountForTests(0)).toBe(3);
  });
});
