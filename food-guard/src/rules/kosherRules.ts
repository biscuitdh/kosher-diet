import type { Profile } from "@/types/Profile";
import type { IngredientMatch, KosherResult, MatchSource } from "@/types/ScanResult";
import { normalizeForMatching } from "./allergyRules";

type KosherTextSource = {
  text: string | null | undefined;
  source: MatchSource;
};

const KOSHER_INDICATORS = [
  "kosher certified",
  "certified kosher",
  "kosher",
  "orthodox union",
  "ou",
  "ok kosher",
  "star k",
  "star-k",
  "kof k",
  "kof-k",
  "pareve",
  "parve",
  "passover",
  "kosher for passover"
];

export function analyzeKosher(sources: readonly KosherTextSource[], profile: Profile): KosherResult {
  if (!profile.kosher.kosherRequired && !profile.kosher.requirePareve && !profile.kosher.passoverMode) {
    return {
      status: "not_required",
      indicators: [],
      explanation: "Kosher preference is not required for this profile."
    };
  }

  const indicators = sources.flatMap(({ text, source }) => findKosherIndicators(text, source));

  const acceptedCerts = profile.kosher.acceptedCertifications.map(normalizeForMatching);
  const acceptedFound = indicators.some((indicator) => acceptedCerts.includes(normalizeForMatching(indicator.term)));
  const pareveFound = indicators.some((indicator) => ["pareve", "parve"].includes(normalizeForMatching(indicator.term)));
  const passoverFound = indicators.some((indicator) => normalizeForMatching(indicator.term).includes("passover"));

  const explanation =
    indicators.length > 0
      ? acceptedFound
        ? "Kosher indicator found. Verify the package symbol before relying on it."
        : "Kosher-related text found, but accepted certification still needs package verification."
      : "Kosher status unknown — check package symbol.";

  return {
    status: indicators.length > 0 ? "indicator_found" : "unknown",
    indicators,
    explanation,
    pareveWarning:
      profile.kosher.requirePareve && !pareveFound
        ? "Pareve status unknown unless specifically marked on the package."
        : undefined,
    passoverWarning:
      profile.kosher.passoverMode && !passoverFound
        ? "Passover status unknown unless specifically marked."
        : undefined
  };
}

function findKosherIndicators(text: string | null | undefined, source: MatchSource): IngredientMatch[] {
  const normalized = normalizeForMatching(text ?? "");
  if (!normalized) return [];

  const found: IngredientMatch[] = [];
  for (const indicator of KOSHER_INDICATORS) {
    const term = normalizeForMatching(indicator);
    const regex = new RegExp(`(^|[^a-z0-9])(${term.replace(/\s+/g, "\\s+")})(?=$|[^a-z0-9])`, "g");
    let match: RegExpExecArray | null;
    while ((match = regex.exec(normalized))) {
      const matchedText = match[2] ?? term;
      if (found.some((item) => normalizeForMatching(item.matchedText) === normalizeForMatching(matchedText))) {
        continue;
      }
      found.push({
        term: indicator,
        matchedText,
        category: "kosher",
        severity: "info",
        source,
        explanation: "Kosher indicator found in product text. This is not proof of current certification."
      });
    }
  }
  return found;
}
