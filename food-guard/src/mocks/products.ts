import type { Product } from "@/types/Product";

export const MOCK_PRODUCTS: Record<string, Product> = {
  "000000000001": {
    barcode: "000000000001",
    productName: "Mock Tomato Pasta Sauce",
    brand: "Food Guard Demo",
    ingredientsText: "Tomato puree, olive oil, garlic, basil, salt.",
    allergens: [],
    labels: ["kosher"],
    imageUrls: {},
    lookupStatus: "mock",
    source: "mock",
    fetchedAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString()
  },
  "000000000002": {
    barcode: "000000000002",
    productName: "Mock Plain Rice Crackers",
    brand: "Food Guard Demo",
    ingredientsText: "Rice flour, sea salt, sunflower oil.",
    allergens: [],
    labels: ["gluten-free"],
    imageUrls: {},
    lookupStatus: "mock",
    source: "mock",
    fetchedAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString()
  },
  "000000000003": {
    barcode: "000000000003",
    productName: "Mock Seasoned Chips",
    brand: "Food Guard Demo",
    ingredientsText: "Corn, vegetable oil, salt, spices, natural flavors.",
    allergens: [],
    labels: [],
    imageUrls: {},
    lookupStatus: "mock",
    source: "mock",
    fetchedAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString()
  }
};
