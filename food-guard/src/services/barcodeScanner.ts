export const FOOD_BARCODE_TYPES = ["ean13", "ean8", "upc_a", "upc_e"] as const;

export type FoodBarcodeType = (typeof FOOD_BARCODE_TYPES)[number];

export function normalizeBarcode(value: string) {
  return value.replace(/\D/g, "").trim();
}

export function isSupportedFoodBarcode(value: string) {
  const barcode = normalizeBarcode(value);
  return [8, 12, 13, 14].includes(barcode.length);
}

export function createScanDebouncer(windowMs = 1400) {
  let lastValue = "";
  let lastAt = 0;

  return (value: string) => {
    const now = Date.now();
    const barcode = normalizeBarcode(value);
    if (!barcode) return false;
    if (barcode === lastValue && now - lastAt < windowMs) return false;
    lastValue = barcode;
    lastAt = now;
    return true;
  };
}
