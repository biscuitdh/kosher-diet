import { z } from "zod";

export const kosherTypeSchema = z.enum(["meat", "dairy", "parve"]);
export type KosherType = z.infer<typeof kosherTypeSchema>;

export const kosherPreferenceSchema = z.enum(["strict", "standard"]);
export type KosherPreference = z.infer<typeof kosherPreferenceSchema>;

export const mealTypeSchema = z.enum(["meat", "dairy", "parve"]);
export type MealType = z.infer<typeof mealTypeSchema>;

export const ALLERGY_OPTIONS = [
  {
    id: "nightshades",
    label: "Nightshades",
    description: "Tomatoes, white potatoes, eggplant, all peppers, paprika, cayenne, goji"
  },
  {
    id: "tomatoes",
    label: "Tomatoes",
    description: "Fresh, sauce, ketchup, paste, sun-dried, and hidden forms"
  },
  { id: "nuts", label: "Nuts", description: "Tree nuts and peanuts" },
  { id: "dairy", label: "Dairy", description: "Milk, butter, cheese, cream, whey" },
  { id: "gluten", label: "Gluten", description: "Wheat, barley, rye, most breads and pasta" },
  { id: "soy", label: "Soy", description: "Soybeans, tofu, soy sauce, edamame" },
  { id: "eggs", label: "Eggs", description: "Whole eggs, whites, yolks, mayonnaise" },
  { id: "fish", label: "Fish", description: "All fish, including kosher fish" },
  { id: "shellfish", label: "Shellfish", description: "Shrimp, lobster, crab, scallops, clams" }
] as const;

export type AllergyId = (typeof ALLERGY_OPTIONS)[number]["id"];

export const DEFAULT_ALLERGIES: AllergyId[] = [
  "nightshades",
  "tomatoes",
  "nuts",
  "dairy",
  "gluten",
  "soy",
  "eggs",
  "fish",
  "shellfish"
];

export const DEFAULT_MEAL_TYPES: MealType[] = ["meat", "dairy", "parve"];

export const profileSchema = z.object({
  displayName: z.string().trim().max(80).optional().default(""),
  allergies: z.array(z.enum(ALLERGY_OPTIONS.map((option) => option.id) as [AllergyId, ...AllergyId[]])).default(DEFAULT_ALLERGIES),
  customAllergies: z
    .string()
    .trim()
    .max(500)
    .optional()
    .default(""),
  kosherPreference: kosherPreferenceSchema.default("strict"),
  mealTypes: z.array(mealTypeSchema).min(1, "Choose at least one meal type").default(DEFAULT_MEAL_TYPES)
});
export type UserProfile = z.infer<typeof profileSchema>;

export const FIXED_SAFETY_PROFILE: UserProfile = profileSchema.parse({
  displayName: "",
  allergies: DEFAULT_ALLERGIES,
  customAllergies: "",
  kosherPreference: "strict",
  mealTypes: DEFAULT_MEAL_TYPES
});

export const ingredientSchema = z.object({
  name: z.string().trim().min(1).max(160),
  quantity: z.string().trim().min(1).max(80),
  unit: z.string().trim().max(40).default("")
});
export type RecipeIngredient = z.infer<typeof ingredientSchema>;

export const recipeSchema = z.object({
  title: z.string().trim().min(3).max(120),
  kosherType: kosherTypeSchema,
  ingredients: z.array(ingredientSchema).min(1).max(80),
  instructions: z.array(z.string().trim().min(1).max(800)).min(1).max(40),
  prepTimeMinutes: z.coerce.number().int().min(0).max(1440),
  cookTimeMinutes: z.coerce.number().int().min(0).max(1440),
  servings: z.coerce.number().int().min(1).max(100),
  notes: z.string().trim().max(1500).default("")
});
export type Recipe = z.infer<typeof recipeSchema>;

export const generationRequestSchema = z.object({
  profile: profileSchema.optional().default(FIXED_SAFETY_PROFILE),
  occasion: z.string().trim().max(120).optional().default("Weeknight dinner"),
  cuisinePreference: z.string().trim().max(120).optional().default("Chef's choice"),
  mainIngredient: z.string().trim().max(120).optional().default("Seasonal vegetables"),
  availableIngredients: z.string().trim().max(500).optional().default(""),
  servings: z.coerce.number().int().min(1).max(24).default(4),
  extraNotes: z.string().trim().max(1000).optional().default(""),
  surpriseMe: z.boolean().optional().default(false),
  variationOf: recipeSchema.optional()
});
export type GenerationRequest = z.infer<typeof generationRequestSchema>;

export const savedRecipeSchema = z.object({
  id: z.string().min(1),
  recipe: recipeSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  imagePath: z.string().min(1),
  source: z.enum(["generated", "imported", "manual"]).default("generated")
});
export type SavedRecipe = z.infer<typeof savedRecipeSchema>;

export const recipeRecordSchema = savedRecipeSchema.extend({
  safetyBadge: z.literal("Nightshade & Tomato Safe ✅").default("Nightshade & Tomato Safe ✅")
});
export type RecipeRecord = z.infer<typeof recipeRecordSchema>;

export const apiErrorSchema = z.object({
  error: z.string(),
  code: z.string().optional()
});

export const apiGenerateResponseSchema = z.union([
  z.object({
    recipe: recipeSchema,
    safety: z.object({
      ok: z.literal(true),
      warnings: z.array(z.string()).default([])
    })
  }),
  apiErrorSchema
]);

export type ApiGenerateResponse = z.infer<typeof apiGenerateResponseSchema>;

export function createDefaultProfile(): UserProfile {
  return profileSchema.parse(FIXED_SAFETY_PROFILE);
}
