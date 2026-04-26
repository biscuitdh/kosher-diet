import type { AllergyRuleId } from "@/types/Profile";
import type { IngredientMatch, MatchCategory, MatchSource } from "@/types/ScanResult";

type RuleSeverity = "avoid" | "possible";

type TermRule = {
  term: string;
  aliases?: string[] | undefined;
  category: Exclude<MatchCategory, "kosher">;
  severity: RuleSeverity;
  rules: AllergyRuleId[];
  explanation: string;
};

type Span = {
  start: number;
  end: number;
};

type TextSource = {
  text?: string | null | undefined;
  source: MatchSource;
};

const TOMATO_TERMS: TermRule[] = [
  tomato("sun-dried tomato", ["sundried tomato"]),
  tomato("tomato paste"),
  tomato("tomato puree", ["tomato purée"]),
  tomato("tomato powder"),
  tomato("tomato sauce"),
  tomato("tomato juice"),
  tomato("tomatoes"),
  tomato("tomato"),
  tomato("ketchup"),
  tomato("catsup"),
  tomato("marinara"),
  tomato("pizza sauce"),
  tomato("pasta sauce"),
  tomato("salsa"),
  tomato("bruschetta"),
  tomato("sofrito")
];

const NIGHTSHADE_TERMS: TermRule[] = [
  nightshade("modified potato starch"),
  nightshade("potato starch"),
  nightshade("potato flour"),
  nightshade("potato flakes"),
  nightshade("potato protein"),
  nightshade("white potato"),
  nightshade("red potato"),
  nightshade("yellow potato"),
  nightshade("crushed red pepper"),
  nightshade("red pepper flakes"),
  nightshade("cayenne pepper"),
  nightshade("chili powder", ["chilli powder"]),
  nightshade("chili pepper", ["chilli pepper", "chile pepper"]),
  nightshade("bell pepper"),
  nightshade("red pepper"),
  nightshade("green pepper"),
  nightshade("jalapeno", ["jalapeño"]),
  nightshade("habanero"),
  nightshade("pimento", ["pimiento"]),
  nightshade("goji berry"),
  nightshade("ground cherry"),
  nightshade("cape gooseberry"),
  nightshade("nightshade"),
  nightshade("potatoes"),
  nightshade("potato"),
  nightshade("paprika"),
  nightshade("peppers"),
  nightshade("cayenne"),
  nightshade("eggplant"),
  nightshade("aubergine"),
  nightshade("tomatillo"),
  nightshade("ashwagandha")
];

const AMBIGUOUS_TERMS: TermRule[] = [
  ambiguous("natural flavors", ["natural flavor"]),
  ambiguous("vegetable powder", ["vegetable powders"]),
  ambiguous("seasoning", ["seasonings"]),
  ambiguous("flavoring", ["flavouring", "flavorings", "flavourings"]),
  ambiguous("spices", ["spice"]),
  ambiguous("pepper")
];

const TERM_RULES = [...TOMATO_TERMS, ...NIGHTSHADE_TERMS, ...AMBIGUOUS_TERMS].flatMap((rule) =>
  [rule.term, ...(rule.aliases ?? [])].map((term) => ({ ...rule, term }))
);

const SORTED_TERM_RULES = [...TERM_RULES].sort(
  (a, b) => normalizeForMatching(b.term).length - normalizeForMatching(a.term).length
);

function tomato(term: string, aliases?: string[]): TermRule {
  return {
    term,
    aliases,
    category: "tomato",
    severity: "avoid",
    rules: ["tomato", "nightshades"],
    explanation: "Definite tomato-related ingredient."
  };
}

function nightshade(term: string, aliases?: string[]): TermRule {
  return {
    term,
    aliases,
    category: "nightshade",
    severity: "avoid",
    rules: ["nightshades"],
    explanation: "Definite nightshade-related ingredient."
  };
}

function ambiguous(term: string, aliases?: string[]): TermRule {
  return {
    term,
    aliases,
    category: "ambiguous",
    severity: "possible",
    rules: ["tomato", "nightshades"],
    explanation: "Ambiguous ingredient that may hide tomato or nightshade ingredients. Verify manually."
  };
}

export function normalizeForMatching(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function analyzeTextForAllergies(
  text: string,
  source: MatchSource,
  enabledRules: readonly AllergyRuleId[] = ["tomato", "nightshades"]
): IngredientMatch[] {
  const normalized = normalizeForMatching(text);
  if (!normalized) return [];

  const enabled = new Set(enabledRules);
  const matches: IngredientMatch[] = [];
  const occupiedSpans: Span[] = [];

  for (const rule of SORTED_TERM_RULES) {
    if (!rule.rules.some((id) => enabled.has(id))) continue;

    const term = normalizeForMatching(rule.term);
    const regex = boundaryRegex(term);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(normalized))) {
      const prefixLength = match[1]?.length ?? 0;
      const matchedText = match[2] ?? "";
      const start = match.index + prefixLength;
      const end = start + matchedText.length;
      const span = { start, end };

      if (isSuppressedFalsePositive(rule, normalized, span)) continue;
      if (occupiedSpans.some((existing) => overlaps(existing, span))) continue;

      occupiedSpans.push(span);
      matches.push({
        term: rule.term,
        matchedText,
        category: rule.category,
        severity: rule.severity,
        source,
        explanation: rule.explanation,
        context: contextFor(normalized, span)
      });
    }
  }

  return matches;
}

export function analyzeSourcesForAllergies(
  sources: readonly TextSource[],
  enabledRules: readonly AllergyRuleId[] = ["tomato", "nightshades"]
) {
  return sources.flatMap(({ text, source }) => {
    if (!text?.trim()) return [];
    return analyzeTextForAllergies(text, source, enabledRules);
  });
}

export function hasDefiniteRisk(matches: readonly IngredientMatch[]) {
  return matches.some((match) => match.severity === "avoid");
}

export function hasPossibleRisk(matches: readonly IngredientMatch[]) {
  return matches.some((match) => match.severity === "possible");
}

function boundaryRegex(term: string) {
  const pattern = term
    .split(" ")
    .filter(Boolean)
    .map(escapeRegex)
    .join("\\s+");
  return new RegExp(`(^|[^a-z0-9])(${pattern})(?=$|[^a-z0-9])`, "g");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function overlaps(a: Span, b: Span) {
  return a.start < b.end && b.start < a.end;
}

function isSuppressedFalsePositive(rule: TermRule, normalized: string, span: Span) {
  const previousWord = wordBefore(normalized, span.start);
  const term = normalizeForMatching(rule.term);

  if ((term === "pepper" || term === "peppers") && (previousWord === "black" || previousWord === "white")) {
    return true;
  }

  if (term.startsWith("potato") && previousWord === "sweet") {
    return true;
  }

  return false;
}

function wordBefore(text: string, start: number) {
  const before = text.slice(0, start).trim();
  const parts = before.split(/\s+/).filter(Boolean);
  return parts.at(-1) ?? "";
}

function contextFor(text: string, span: Span) {
  const start = Math.max(0, span.start - 36);
  const end = Math.min(text.length, span.end + 36);
  return text.slice(start, end).trim();
}
