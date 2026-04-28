export type ProductLookupStatus = "found" | "not_found" | "network_error" | "malformed" | "cancelled" | "mock" | "manual";

export type ProductImageUrls = {
  front?: string | undefined;
  ingredients?: string | undefined;
  general?: string | undefined;
};

export type ManualNote = {
  id: string;
  productBarcode: string;
  profileId?: string | undefined;
  text: string;
  createdAt: string;
  updatedAt: string;
};

export type Product = {
  barcode: string;
  productName?: string | undefined;
  brand?: string | undefined;
  ingredientsText?: string | undefined;
  allergens?: string[] | undefined;
  labels?: string[] | undefined;
  imageUrls?: ProductImageUrls | undefined;
  ocrText?: string | undefined;
  manualNotes?: ManualNote[] | undefined;
  lookupStatus: ProductLookupStatus;
  lookupMessage?: string | undefined;
  source: "open-food-facts" | "mock" | "manual" | "ocr";
  fetchedAt: string;
  updatedAt: string;
};

export function productHasIngredientData(product: Pick<Product, "ingredientsText" | "ocrText">) {
  return Boolean(product.ingredientsText?.trim() || product.ocrText?.trim());
}
