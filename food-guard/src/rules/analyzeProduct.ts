import type { Product } from "@/types/Product";
import { productHasIngredientData } from "@/types/Product";
import type { Profile } from "@/types/Profile";
import type { IngredientMatch, MatchSource, ResultStatus, ScanResult } from "@/types/ScanResult";
import { PACKAGE_LABEL_WARNING } from "@/types/ScanResult";
import { analyzeSourcesForAllergies, hasDefiniteRisk, hasPossibleRisk } from "./allergyRules";
import { analyzeKosher } from "./kosherRules";

export function analyzeProduct(product: Product, profile: Profile): ScanResult {
  const createdAt = new Date().toISOString();
  const allergySources = buildAllergySources(product);
  const matches = analyzeSourcesForAllergies(allergySources, profile.allergyRules);
  const kosher = analyzeKosher(buildKosherSources(product), profile);
  const status = determineStatus(product, matches);

  return {
    id: `scan-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    productBarcode: product.barcode,
    productName: product.productName?.trim() || "Unknown product",
    brand: product.brand,
    profile,
    status,
    matches,
    kosher,
    explanation: explanationFor(status, product, matches),
    warning: PACKAGE_LABEL_WARNING,
    productSnapshot: product,
    createdAt
  };
}

function buildAllergySources(product: Product): Array<{ text: string | undefined; source: MatchSource }> {
  return [
    {
      text: [product.productName, product.brand].filter(Boolean).join(" "),
      source: "barcode"
    },
    { text: product.ingredientsText, source: "ingredients" },
    { text: product.allergens?.join(", "), source: "allergens" },
    { text: product.labels?.join(", "), source: "labels" },
    { text: product.ocrText, source: "ocr" },
    { text: product.manualNotes?.map((note) => note.text).join("\n"), source: "manual" }
  ];
}

function buildKosherSources(product: Product): Array<{ text: string | undefined; source: MatchSource }> {
  return [
    {
      text: [product.productName, product.brand].filter(Boolean).join(" "),
      source: "barcode"
    },
    { text: product.ingredientsText, source: "ingredients" },
    { text: product.labels?.join(", "), source: "labels" },
    { text: product.ocrText, source: "ocr" },
    { text: product.manualNotes?.map((note) => note.text).join("\n"), source: "manual" }
  ];
}

function determineStatus(product: Product, matches: readonly IngredientMatch[]): ResultStatus {
  if (hasDefiniteRisk(matches)) return "Avoid";
  if (hasPossibleRisk(matches)) return "Possible Risk";
  if (productHasIngredientData(product)) return "Likely OK";
  return "Unknown";
}

function explanationFor(status: ResultStatus, product: Product, matches: readonly IngredientMatch[]) {
  switch (status) {
    case "Avoid":
      return `Definite tomato or nightshade match found: ${matches
        .filter((match) => match.severity === "avoid")
        .map((match) => match.term)
        .join(", ")}.`;
    case "Possible Risk":
      return `Ambiguous ingredient text found: ${matches
        .filter((match) => match.severity === "possible")
        .map((match) => match.term)
        .join(", ")}. Verify manually.`;
    case "Likely OK":
      return "Ingredient data is present and no configured tomato, nightshade, or ambiguous matches were found.";
    case "Unknown":
      return product.lookupMessage || "Unknown — check label manually.";
  }
}
