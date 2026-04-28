import { allergyLabels, validateRecipeSafety } from "@/lib/validators/forbidden-ingredients";
import { COOKING_DEVICE_LABELS, type GenerationRequest, type Recipe } from "@/lib/schemas";

export const STRICT_KOSHER_ALLERGY_SYSTEM_PROMPT =
  "You are a professional kosher chef AI. Generate recipes that are 100% kosher and respect the user's allergies.\nRules you MUST follow:\n- No pork, bacon, ham, lard, shellfish, shrimp, lobster, crab, catfish, or any non-kosher fish.\n- No mixing meat and dairy in the same recipe. If the recipe is meat, say 'Meat'; dairy = 'Dairy'; neutral = 'Parve'.\n- No blood, no gelatin from non-kosher sources, no non-kosher wine.\n- All ingredients must be clearly labeled as meat/dairy/parve.\n- User is allergic to NIGHTSHADES and TOMATOES. Completely avoid: tomatoes (fresh, sauce, ketchup, paste, sun-dried, etc.), white potatoes, eggplant, ALL peppers (bell, chili, jalapeño, etc.), paprika, cayenne, goji berries, and any other nightshade ingredients. Sweet potatoes are allowed.\n- Respect any additional user allergies listed.\n- Suggest safe substitutions when possible.\n- Output ONLY valid JSON with this exact schema: { title, kosherType, ingredients: [{name, quantity, unit}], instructions: string[], prepTimeMinutes, cookTimeMinutes, servings, notes }";

export function buildRecipeUserPrompt(input: GenerationRequest, retryContext?: string) {
  const profile = input.profile;
  const selectedAllergies = allergyLabels(profile.allergies);
  const allowedMealTypes = profile.mealTypes.join(", ");
  const variation = input.variationOf
    ? `\nCreate a distinct variation of this existing recipe, preserving safety constraints:\n${JSON.stringify(input.variationOf)}`
    : "";

  return [
    "Generate one practical, appealing kosher recipe.",
    `Kosher preference: ${profile.kosherPreference}.`,
    `Allowed meal types: ${allowedMealTypes}.`,
    `Additional allergies selected by user: ${selectedAllergies.join(", ") || "none"}.`,
    `Custom allergy notes: ${profile.customAllergies || "none"}.`,
    `Requested recipe name or style: ${input.recipeName || "none"}.`,
    `Occasion: ${input.surpriseMe ? "Surprise me with something fitting" : input.occasion}.`,
    `Cuisine preference: ${input.surpriseMe ? "Surprise me" : input.cuisinePreference}.`,
    `Main protein or vegetable: ${input.surpriseMe ? "Surprise me" : input.mainIngredient}.`,
    `Cooking device preference: ${COOKING_DEVICE_LABELS[input.cookingDevice]}. Treat this as a strong preference, but keep the recipe practical if the dish needs a safe adjacent method.`,
    `Ingredients on hand or requested inclusions: ${input.availableIngredients || "none"}. Use these only when safe and compatible; never override kosher, allergy, nightshade, or tomato restrictions.`,
    input.kosherForPassover
      ? "Kosher for Passover: yes. Use strict no-kitniyot Passover rules: no chametz and no rice, corn, beans, lentils, chickpeas, soy, tofu, sesame, tahini, mustard, buckwheat, caraway, cardamom, fennel seeds, peas, or similar kitniyot."
      : "Kosher for Passover: no.",
    `Servings: ${input.servings}.`,
    "Use only ingredients that are safe under the system prompt and the fixed safety profile.",
    "Ingredient names must include kosher labels in parentheses, for example: Chicken breast (meat), Olive oil (parve), Milk (dairy).",
    "Return lowercase kosherType exactly as one of: meat, dairy, parve.",
    variation,
    retryContext ? `Previous attempt was rejected: ${retryContext}. Generate a corrected safe recipe.` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

export function summarizeSafetyFailure(recipe: Recipe, input: GenerationRequest) {
  const safety = validateRecipeSafety(recipe, input.profile);
  return safety.issues.map((issue) => `${issue.reason} in "${issue.ingredient}"`).join("; ");
}
