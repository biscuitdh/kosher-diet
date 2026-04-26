import { ALLERGY_OPTIONS, type AllergyId, type Recipe, type UserProfile } from "@/lib/schemas";

export type SafetyIssue = {
  ingredient: string;
  reason: string;
  pattern: string;
};

export type SafetyResult = {
  ok: boolean;
  issues: SafetyIssue[];
  warnings: string[];
};

const BASE_FORBIDDEN_PATTERNS: Array<[RegExp, string]> = [
  [/\btomato(?:es)?\b|\bketchup\b|\bmarinara\b|\btomato\s+(?:paste|sauce|puree|powder)\b|\bsun[-\s]?dried tomato/i, "tomatoes"],
  [/\bwhite potato(?:es)?\b|\bridset potato(?:es)?\b|\byukon gold\b|\brusset\b|\bpotato starch\b/i, "nightshades"],
  [/\beggplant\b|\baubergine\b/i, "nightshades"],
  [/\b(?:bell|chili|chile|jalapeno|jalapeño|serrano|habanero|poblano|anaheim|cayenne|thai)\s+pepper(?:s)?\b|\bpepperoncini\b|\bpimento\b/i, "nightshades"],
  [/\bpaprika\b|\bcayenne\b|\bgoji(?:\s+berries)?\b|\bharissa\b|\bchili\s+(?:powder|flakes|oil)\b|\bhot sauce\b|\bsriracha\b/i, "nightshades"],
  [/\bpork\b|\bbacon\b|\bham\b|\blard\b|\bpancetta\b|\bprosciutto\b|\bsalami\b/i, "non-kosher meat"],
  [/\bshrimp\b|\blobster\b|\bcrab\b|\bclam(?:s)?\b|\boyster(?:s)?\b|\bscallop(?:s)?\b|\bmussel(?:s)?\b|\bshellfish\b/i, "shellfish"],
  [/\bcatfish\b|\bsturgeon\b|\bshark\b|\bswordfish\b|\beel\b|\bmonkfish\b|\bskate\b|\btilapia gelatin\b/i, "non-kosher fish"],
  [/\bnon[-\s]?kosher wine\b|\bblood\b|\bblack pudding\b|\bgelatin\b(?!\s*\(kosher|\s+from kosher)/i, "kosher restriction"]
];

const ALLERGY_PATTERNS: Record<AllergyId, Array<[RegExp, string]>> = {
  nightshades: BASE_FORBIDDEN_PATTERNS.filter(([, reason]) => reason === "nightshades" || reason === "tomatoes"),
  tomatoes: BASE_FORBIDDEN_PATTERNS.filter(([, reason]) => reason === "tomatoes"),
  nuts: [
    [/\bpeanut(?:s)?\b|\bpeanut butter\b|\balmond(?:s)?\b|\bcashew(?:s)?\b|\bwalnut(?:s)?\b|\bpecan(?:s)?\b|\bpistachio(?:s)?\b|\bhazelnut(?:s)?\b|\bmacadamia(?:s)?\b|\bpine nut(?:s)?\b|\btahini\b|\bsesame\b/i, "nuts"]
  ],
  dairy: [
    [/\bmilk\b|\bcream\b|\bbutter\b|\bghee\b|\bcheese\b|\bcheddar\b|\bmozzarella\b|\bfeta\b|\byogurt\b|\byoghurt\b|\bwhey\b|\bcasein\b|\bhalf[-\s]?and[-\s]?half\b/i, "dairy"]
  ],
  gluten: [
    [/\bwheat\b|\bbarley\b|\brye\b|\bspelt\b|\bfarro\b|\bcouscous\b|\bbulgur\b|\bsemolina\b|\bseitan\b|\bbread\b|\bpasta\b|\bflour\b(?!\s*\(gluten[-\s]?free\))/i, "gluten"]
  ],
  soy: [
    [/\bsoy\b|\bsoya\b|\btofu\b|\btempeh\b|\bedamame\b|\bmiso\b|\btamari\b|\bsoy sauce\b|\btextured vegetable protein\b|\btvp\b/i, "soy"]
  ],
  eggs: [
    [/\begg(?:s)?\b|\begg white(?:s)?\b|\begg yolk(?:s)?\b|\bmayonnaise\b|\bmayo\b|\baioli\b/i, "eggs"]
  ],
  fish: [
    [/\bsalmon\b|\btuna\b|\bcod\b|\bhalibut\b|\btrout\b|\bsole\b|\btilapia\b|\bfish\b|\banchov(?:y|ies)\b|\bsardine(?:s)?\b/i, "fish"]
  ],
  shellfish: [
    [/\bshrimp\b|\blobster\b|\bcrab\b|\bclam(?:s)?\b|\boyster(?:s)?\b|\bscallop(?:s)?\b|\bmussel(?:s)?\b|\bshellfish\b/i, "shellfish"]
  ]
};

export function normalizeCustomAllergies(customAllergies?: string) {
  if (!customAllergies) return [];
  return customAllergies
    .split(/[,;\n]/)
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length >= 2)
    .slice(0, 30);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function recipeSearchText(recipe: Recipe) {
  return [
    recipe.title,
    recipe.notes,
    recipe.kosherType,
    ...recipe.ingredients.map((ingredient) => `${ingredient.name} ${ingredient.quantity} ${ingredient.unit}`),
    ...recipe.instructions
  ].join("\n");
}

function getIngredientTexts(recipe: Recipe) {
  return recipe.ingredients.map((ingredient) => `${ingredient.name} ${ingredient.quantity} ${ingredient.unit}`.trim());
}

export function validateRecipeSafety(recipe: Recipe, profile?: UserProfile): SafetyResult {
  const issues: SafetyIssue[] = [];
  const warnings: string[] = [];
  const texts = getIngredientTexts(recipe);
  const wholeRecipeText = recipeSearchText(recipe);
  const patterns: Array<[RegExp, string]> = [...BASE_FORBIDDEN_PATTERNS];

  for (const allergy of profile?.allergies ?? []) {
    patterns.push(...ALLERGY_PATTERNS[allergy]);
  }

  for (const custom of normalizeCustomAllergies(profile?.customAllergies)) {
    patterns.push([new RegExp(`\\b${escapeRegex(custom)}\\b`, "i"), `custom allergy: ${custom}`]);
  }

  const seen = new Set<string>();
  for (const text of texts) {
    for (const [pattern, reason] of patterns) {
      if (!pattern.test(text)) continue;
      const key = `${text}:${reason}:${pattern.source}`;
      if (seen.has(key)) continue;
      seen.add(key);
      issues.push({
        ingredient: text,
        reason,
        pattern: pattern.source
      });
    }
  }

  if (/meat/i.test(wholeRecipeText) && /\b(?:milk|cream|butter|cheese|yogurt|whey|casein)\b/i.test(wholeRecipeText)) {
    issues.push({
      ingredient: "recipe text",
      reason: "meat and dairy mixing risk",
      pattern: "meat+dairy"
    });
  }

  if (!recipe.ingredients.some((ingredient) => /\((meat|dairy|parve)\)/i.test(ingredient.name))) {
    warnings.push("Ingredients should include kosher labels in their names, e.g. Chicken breast (meat).");
  }

  return {
    ok: issues.length === 0,
    issues,
    warnings
  };
}

export function allergyLabels(ids: readonly AllergyId[]) {
  const labels: Record<AllergyId, string> = Object.fromEntries(
    ALLERGY_OPTIONS.map((option) => [option.id, option.label])
  ) as Record<AllergyId, string>;
  return ids.map((id) => labels[id]);
}
