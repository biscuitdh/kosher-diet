import { MOCK_PRODUCTS } from "@/mocks/products";
import type { Product } from "@/types/Product";

export type ProductLookupFailureReason = "not_found" | "network_error" | "malformed" | "cancelled";

export type ProductLookupResult =
  | {
      ok: true;
      product: Product;
      fromCache?: boolean;
      warning?: string;
    }
  | {
      ok: false;
      reason: ProductLookupFailureReason;
      message: string;
      product: Product;
    };

export type ProductLookupOptions = {
  useMockFallback?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
};

const OPEN_FOOD_FACTS_BASE = "https://world.openfoodfacts.org/api/v2/product";
const USER_AGENT = "FoodGuard/0.1.0 (private-family-use; no account; local-first)";
const DEFAULT_LOOKUP_TIMEOUT_MS = 8_000;

const PRODUCT_FIELDS = [
  "code",
  "product_name",
  "product_name_en",
  "brands",
  "ingredients_text",
  "ingredients_text_en",
  "allergens",
  "allergens_tags",
  "labels",
  "labels_tags",
  "image_url",
  "image_front_url",
  "image_ingredients_url"
].join(",");

export async function lookupProductByBarcode(
  barcode: string,
  options: ProductLookupOptions = {}
): Promise<ProductLookupResult> {
  const normalizedBarcode = barcode.trim();
  const now = new Date().toISOString();
  const mock = MOCK_PRODUCTS[normalizedBarcode];

  if (!normalizedBarcode) {
    return failure("malformed", "Barcode is empty.", normalizedBarcode, now);
  }

  const timeout = createTimeoutSignal(options);

  try {
    const url = `${OPEN_FOOD_FACTS_BASE}/${encodeURIComponent(normalizedBarcode)}.json?fields=${PRODUCT_FIELDS}`;
    const response = await fetch(url, {
      method: "GET",
      signal: timeout.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT
      }
    });

    if (!response.ok) {
      return fallbackOrFailure(mock, "network_error", `Open Food Facts returned HTTP ${response.status}.`, normalizedBarcode, now, options);
    }

    const payload = (await response.json()) as unknown;
    const parsed = parseOpenFoodFactsPayload(payload, normalizedBarcode, now);
    if (parsed.ok) return parsed;

    return fallbackOrFailure(mock, parsed.reason, parsed.message, normalizedBarcode, now, options);
  } catch (error) {
    if (lookupWasCancelled(timeout.timedOut, options.signal?.aborted)) {
      return failure("cancelled", "Open Food Facts lookup was cancelled.", normalizedBarcode, now);
    }

    const message = lookupErrorMessage(error, timeout.timedOut, options.signal?.aborted);
    return fallbackOrFailure(mock, "network_error", message, normalizedBarcode, now, options);
  } finally {
    timeout.cleanup();
  }
}

function lookupWasCancelled(timedOut: boolean, cancelled?: boolean) {
  return Boolean(cancelled && !timedOut);
}

function lookupErrorMessage(error: unknown, timedOut: boolean, cancelled?: boolean) {
  if (timedOut) return "Open Food Facts lookup timed out. Try again or scan the ingredient label.";
  if (cancelled) return "Open Food Facts lookup was cancelled.";
  return error instanceof Error ? error.message : "Network request failed.";
}

function lookupTimeoutMs(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : DEFAULT_LOOKUP_TIMEOUT_MS;
}

function createTimeoutSignal(options: ProductLookupOptions) {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, lookupTimeoutMs(options.timeoutMs));

  const abortFromParent = () => controller.abort();
  if (options.signal?.aborted) {
    controller.abort();
  } else {
    options.signal?.addEventListener("abort", abortFromParent, { once: true });
  }

  return {
    signal: controller.signal,
    get timedOut() {
      return timedOut;
    },
    cleanup() {
      clearTimeout(timeoutId);
      options.signal?.removeEventListener("abort", abortFromParent);
    }
  };
}

function parseOpenFoodFactsPayload(payload: unknown, barcode: string, now: string): ProductLookupResult {
  if (!isRecord(payload)) {
    return failure("malformed", "Open Food Facts response was not a JSON object.", barcode, now);
  }

  if (payload.status === 0 || payload.status_verbose === "product not found") {
    return failure("not_found", "Product not found in Open Food Facts.", barcode, now);
  }

  if (!isRecord(payload.product)) {
    return failure("malformed", "Open Food Facts response did not include a product object.", barcode, now);
  }

  const productRecord = payload.product;
  const product: Product = {
    barcode,
    productName: stringField(productRecord.product_name_en) || stringField(productRecord.product_name),
    brand: stringField(productRecord.brands),
    ingredientsText: stringField(productRecord.ingredients_text_en) || stringField(productRecord.ingredients_text),
    allergens: splitList(productRecord.allergens, productRecord.allergens_tags),
    labels: splitList(productRecord.labels, productRecord.labels_tags),
    imageUrls: {
      general: stringField(productRecord.image_url),
      front: stringField(productRecord.image_front_url),
      ingredients: stringField(productRecord.image_ingredients_url)
    },
    lookupStatus: "found",
    source: "open-food-facts",
    fetchedAt: now,
    updatedAt: now
  };

  return { ok: true, product };
}

function fallbackOrFailure(
  mock: Product | undefined,
  reason: ProductLookupFailureReason,
  message: string,
  barcode: string,
  now: string,
  options: { useMockFallback?: boolean }
): ProductLookupResult {
  if (reason !== "cancelled" && options.useMockFallback !== false && mock) {
    return {
      ok: true,
      product: {
        ...mock,
        fetchedAt: now,
        updatedAt: now,
        lookupMessage: `Using local mock data because lookup failed: ${message}`
      },
      warning: message
    };
  }

  return failure(reason, message, barcode, now);
}

function failure(reason: ProductLookupFailureReason, message: string, barcode: string, now: string): ProductLookupResult {
  return {
    ok: false,
    reason,
    message,
    product: {
      barcode,
      lookupStatus: reason,
      lookupMessage: reason === "not_found" ? "Unknown — check label manually." : message,
      source: "open-food-facts",
      fetchedAt: now,
      updatedAt: now
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function splitList(...values: unknown[]) {
  const items = values.flatMap((value) => {
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
    if (typeof value === "string") return value.split(/[,;]/);
    return [];
  });

  return [...new Set(items.map((item) => item.replace(/^en:/, "").trim()).filter(Boolean))];
}
