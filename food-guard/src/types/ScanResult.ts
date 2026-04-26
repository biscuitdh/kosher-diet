import type { Product } from "./Product";
import type { Profile } from "./Profile";

export type ResultStatus = "Avoid" | "Possible Risk" | "Likely OK" | "Unknown";

export type MatchCategory = "tomato" | "nightshade" | "ambiguous" | "kosher";

export type MatchSeverity = "avoid" | "possible" | "info";

export type MatchSource = "barcode" | "ingredients" | "allergens" | "labels" | "ocr" | "manual";

export type IngredientMatch = {
  term: string;
  matchedText: string;
  category: MatchCategory;
  severity: MatchSeverity;
  source: MatchSource;
  explanation: string;
  context?: string | undefined;
};

export type KosherStatus = "indicator_found" | "unknown" | "not_required";

export type KosherResult = {
  status: KosherStatus;
  indicators: IngredientMatch[];
  explanation: string;
  passoverWarning?: string | undefined;
  pareveWarning?: string | undefined;
};

export type ScanResult = {
  id: string;
  productBarcode: string;
  productName: string;
  brand?: string | undefined;
  profile: Profile;
  status: ResultStatus;
  matches: IngredientMatch[];
  kosher: KosherResult;
  explanation: string;
  warning: string;
  productSnapshot: Product;
  createdAt: string;
};

export const PACKAGE_LABEL_WARNING =
  "Always verify against the package label. Ingredients and certifications can change.";
