import { afterEach, describe, expect, it, vi } from "vitest";
import { lookupProductByBarcode } from "@/services/openFoodFacts";

describe("Open Food Facts lookup", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("maps product fields from a successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          status: 1,
          product: {
            product_name: "Rice Cakes",
            brands: "Demo Brand",
            ingredients_text: "Whole grain rice, salt.",
            allergens_tags: ["en:sesame"],
            labels_tags: ["en:kosher"],
            image_url: "https://example.test/image.jpg"
          }
        })
      }))
    );

    const result = await lookupProductByBarcode("123456789012", { useMockFallback: false });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.product.productName).toBe("Rice Cakes");
      expect(result.product.ingredientsText).toContain("rice");
      expect(result.product.labels).toContain("kosher");
    }
  });

  it("returns not_found without live network", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ status: 0, status_verbose: "product not found" })
      }))
    );

    const result = await lookupProductByBarcode("999999999999", { useMockFallback: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not_found");
  });

  it("falls back to mock data for known development barcodes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      })
    );

    const result = await lookupProductByBarcode("000000000001", { useMockFallback: true });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.product.source).toBe("mock");
  });

  it("times out slow product lookups", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        });
      })
    );

    const resultPromise = lookupProductByBarcode("123456789012", { useMockFallback: false, timeoutMs: 25 });
    await vi.advanceTimersByTimeAsync(25);

    const result = await resultPromise;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("network_error");
      expect(result.message).toMatch(/timed out/i);
    }
  });

  it("does not fall back to mock data when a caller cancels the lookup", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        });
      })
    );

    const resultPromise = lookupProductByBarcode("000000000001", { useMockFallback: true, signal: controller.signal });
    controller.abort();

    const result = await resultPromise;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("cancelled");
      expect(result.product.source).toBe("open-food-facts");
    }
  });
});
