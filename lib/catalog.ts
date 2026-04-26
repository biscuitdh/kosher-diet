import { RECIPE_IMAGE_PLACEHOLDERS } from "@/lib/constants";
import {
  FIXED_SAFETY_PROFILE,
  recipeRecordSchema,
  recipeSchema,
  type GenerationRequest,
  type Recipe,
  type RecipeRecord
} from "@/lib/schemas";
import { validateRecipeSafety } from "@/lib/validators/forbidden-ingredients";

const CATALOG_SIZE = 1000;

type CatalogMeta = {
  cuisine: string;
  occasion: string;
  main: string;
  base: string;
  keywords: string[];
};

export type CatalogRecipeRecord = RecipeRecord & {
  catalog: CatalogMeta;
};

export type CatalogQuery = Partial<
  Pick<
    GenerationRequest,
    "occasion" | "cuisinePreference" | "mainIngredient" | "availableIngredients" | "extraNotes" | "servings" | "variationOf"
  >
>;

const cuisines = [
  { name: "Mediterranean", prefix: "Mediterranean", flavors: ["lemon", "parsley", "oregano"] },
  { name: "Sephardi", prefix: "Sephardi", flavors: ["cumin", "coriander", "turmeric"] },
  { name: "Ashkenazi", prefix: "Ashkenazi", flavors: ["dill", "parsley", "caraway"] },
  { name: "Modern Israeli", prefix: "Modern Israeli", flavors: ["lemon", "mint", "sumac"] },
  { name: "Moroccan-inspired", prefix: "Moroccan", flavors: ["cumin", "cinnamon", "ginger"] },
  { name: "Persian-inspired", prefix: "Persian", flavors: ["dill", "lime", "turmeric"] },
  { name: "Levantine-inspired", prefix: "Levantine", flavors: ["sumac", "parsley", "lemon"] },
  { name: "Yemenite-inspired", prefix: "Yemenite", flavors: ["coriander", "cardamom", "garlic"] }
] as const;

const occasions = [
  "Weeknight dinner",
  "Shabbat dinner",
  "Shabbat lunch",
  "Holiday side",
  "Lunch prep",
  "Make-ahead dinner",
  "Family lunch",
  "Light supper"
] as const;

const mains = [
  { title: "Chicken Thighs", ingredient: "Boneless chicken thighs (meat)", quantity: "1.5", unit: "lb", kosherType: "meat" },
  { title: "Chicken Breast", ingredient: "Chicken breast (meat)", quantity: "1.5", unit: "lb", kosherType: "meat" },
  { title: "Turkey Cutlets", ingredient: "Turkey cutlets (meat)", quantity: "1.25", unit: "lb", kosherType: "meat" },
  { title: "Lean Beef", ingredient: "Lean beef strips (meat)", quantity: "1.25", unit: "lb", kosherType: "meat" },
  { title: "Lamb Shoulder", ingredient: "Lamb shoulder cubes (meat)", quantity: "1.5", unit: "lb", kosherType: "meat" },
  { title: "Red Lentils", ingredient: "Red lentils (parve)", quantity: "1.5", unit: "cups", kosherType: "parve" },
  { title: "Green Lentils", ingredient: "Green lentils (parve)", quantity: "1.5", unit: "cups", kosherType: "parve" },
  { title: "Chickpeas", ingredient: "Chickpeas (parve)", quantity: "2", unit: "cups", kosherType: "parve" },
  { title: "White Beans", ingredient: "White beans (parve)", quantity: "2", unit: "cups", kosherType: "parve" },
  { title: "Mushrooms", ingredient: "Cremini mushrooms (parve)", quantity: "1.5", unit: "lb", kosherType: "parve" },
  { title: "Sweet Potatoes", ingredient: "Sweet potatoes (parve)", quantity: "2", unit: "large", kosherType: "parve" },
  { title: "Cauliflower", ingredient: "Cauliflower florets (parve)", quantity: "6", unit: "cups", kosherType: "parve" }
] as const;

const bases = [
  { title: "Quinoa", ingredient: "Quinoa (parve)", quantity: "1.25", unit: "cups" },
  { title: "Brown Rice", ingredient: "Brown rice (parve)", quantity: "1.25", unit: "cups" },
  { title: "Basmati Rice", ingredient: "Basmati rice (parve)", quantity: "1.25", unit: "cups" },
  { title: "Millet", ingredient: "Millet (parve)", quantity: "1", unit: "cup" },
  { title: "Buckwheat Groats", ingredient: "Buckwheat groats (parve)", quantity: "1", unit: "cup" },
  { title: "Sorghum", ingredient: "Sorghum (parve)", quantity: "1", unit: "cup" },
  { title: "Amaranth", ingredient: "Amaranth (parve)", quantity: "1", unit: "cup" },
  { title: "Cauliflower Rice", ingredient: "Cauliflower rice (parve)", quantity: "5", unit: "cups" }
] as const;

const vegetableSets = [
  { title: "Carrots and Zucchini", items: ["Carrots (parve)", "Zucchini (parve)", "Yellow onions (parve)"] },
  { title: "Fennel and Celery", items: ["Fennel bulb (parve)", "Celery (parve)", "Carrots (parve)"] },
  { title: "Squash and Kale", items: ["Butternut squash (parve)", "Kale (parve)", "Yellow onions (parve)"] },
  { title: "Cabbage and Mushrooms", items: ["Green cabbage (parve)", "Cremini mushrooms (parve)", "Carrots (parve)"] },
  { title: "Green Beans and Leeks", items: ["Green beans (parve)", "Leeks (parve)", "Carrots (parve)"] },
  { title: "Beets and Parsnips", items: ["Beets (parve)", "Parsnips (parve)", "Carrots (parve)"] },
  { title: "Broccoli and Cauliflower", items: ["Broccoli florets (parve)", "Cauliflower florets (parve)", "Yellow onions (parve)"] },
  { title: "Mushrooms and Leeks", items: ["Cremini mushrooms (parve)", "Leeks (parve)", "Celery (parve)"] }
] as const;

const flavorSets = [
  { title: "Lemon Herb", items: ["Lemon juice (parve)", "Fresh parsley (parve)", "Garlic cloves (parve)"] },
  { title: "Cumin Turmeric", items: ["Ground cumin (parve)", "Ground turmeric (parve)", "Ground coriander (parve)"] },
  { title: "Dill Lemon", items: ["Fresh dill (parve)", "Lemon zest (parve)", "Garlic cloves (parve)"] },
  { title: "Ginger Cinnamon", items: ["Fresh ginger (parve)", "Ground cinnamon (parve)", "Ground coriander (parve)"] },
  { title: "Rosemary Thyme", items: ["Fresh rosemary (parve)", "Fresh thyme (parve)", "Garlic cloves (parve)"] },
  { title: "Sumac Parsley", items: ["Ground sumac (parve)", "Fresh parsley (parve)", "Lemon juice (parve)"] },
  { title: "Cardamom Cumin", items: ["Ground cardamom (parve)", "Ground cumin (parve)", "Garlic cloves (parve)"] },
  { title: "Mint Lime", items: ["Fresh mint (parve)", "Lime juice (parve)", "Ground coriander (parve)"] },
  { title: "Garlic Oregano", items: ["Garlic cloves (parve)", "Dried oregano (parve)", "Lemon juice (parve)"] },
  { title: "Caraway Dill", items: ["Caraway seeds (parve)", "Fresh dill (parve)", "Apple cider vinegar (parve)"] }
] as const;

function ingredient(name: string, quantity: string, unit: string) {
  return { name, quantity, unit };
}

function buildRecipe(index: number): CatalogRecipeRecord {
  const cuisine = cuisines[index % cuisines.length];
  const occasion = occasions[Math.floor(index / cuisines.length) % occasions.length];
  const main = mains[(index * 7) % mains.length];
  const base = bases[(index * 5) % bases.length];
  const vegetables = vegetableSets[(index * 3) % vegetableSets.length];
  const flavor = flavorSets[(index * 11) % flavorSets.length];
  const servings = [2, 4, 6, 8, 10, 12][index % 6];
  const imagePath = RECIPE_IMAGE_PLACEHOLDERS[index % RECIPE_IMAGE_PLACEHOLDERS.length];
  const prepTimeMinutes = 12 + (index % 4) * 3;
  const cookTimeMinutes = main.kosherType === "meat" ? 28 + (index % 5) * 4 : 22 + (index % 5) * 3;
  const title = `${cuisine.prefix} ${flavor.title} ${main.title} with ${base.title}`;

  const recipe: Recipe = recipeSchema.parse({
    title,
    kosherType: main.kosherType,
    ingredients: [
      ingredient(main.ingredient, main.quantity, main.unit),
      ingredient(base.ingredient, base.quantity, base.unit),
      ...vegetables.items.map((item, itemIndex) => ingredient(item, itemIndex === 0 ? "2" : "1", itemIndex === 0 ? "cups" : "cup")),
      ...flavor.items.map((item, itemIndex) => ingredient(item, itemIndex === 0 ? "2" : "1", itemIndex === 0 ? "tsp" : "tbsp")),
      ingredient("Extra virgin olive oil (parve)", "2", "tbsp"),
      ingredient("Kosher salt (parve)", "1", "tsp"),
      ingredient("Water (parve)", "2", "cups")
    ],
    instructions: [
      `Rinse the ${base.title.toLowerCase()} and cook it with water and a pinch of kosher salt until tender.`,
      `Warm olive oil in a wide pan, then cook the ${vegetables.title.toLowerCase()} until glossy and lightly softened.`,
      `Add the ${main.title.toLowerCase()} with the ${flavor.title.toLowerCase()} seasonings and cook until the main ingredient is done.`,
      "Fold in the cooked base, adjust salt, and let the pan rest for five minutes before serving.",
      "Finish with fresh herbs or citrus from the ingredient list and serve warm."
    ],
    prepTimeMinutes,
    cookTimeMinutes,
    servings,
    notes: `${occasion} catalog recipe. ${cuisine.name} style, built for the fixed KosherTable safety profile with simple ingredients and clear kosher labels.`
  });

  const safety = validateRecipeSafety(recipe, FIXED_SAFETY_PROFILE);
  if (!safety.ok) {
    throw new Error(`Unsafe catalog recipe ${index}: ${safety.issues.map((issue) => issue.reason).join(", ")}`);
  }

  const baseRecord = recipeRecordSchema.parse({
    id: `catalog-${String(index + 1).padStart(4, "0")}`,
    recipe,
    createdAt: "2026-04-26T00:00:00.000Z",
    updatedAt: "2026-04-26T00:00:00.000Z",
    imagePath,
    source: "imported",
    safetyBadge: "Nightshade & Tomato Safe ✅"
  });

  return {
    ...baseRecord,
    catalog: {
      cuisine: cuisine.name,
      occasion,
      main: main.title,
      base: base.title,
      keywords: [
        cuisine.name,
        cuisine.prefix,
        occasion,
        main.title,
        main.ingredient,
        base.title,
        base.ingredient,
        vegetables.title,
        ...vegetables.items,
        flavor.title,
        ...flavor.items,
        ...cuisine.flavors
      ].map((value) => value.toLowerCase())
    }
  };
}

const catalogRecipes: CatalogRecipeRecord[] = Array.from({ length: CATALOG_SIZE }, (_, index) => buildRecipe(index));

function normalize(value?: string | number) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function terms(value?: string) {
  return normalize(value)
    .split(/\s+|,/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3 && !["and", "with", "the", "for", "want", "include"].includes(term));
}

function recordText(record: CatalogRecipeRecord) {
  return normalize([
    record.recipe.title,
    record.recipe.kosherType,
    record.recipe.notes,
    record.catalog.cuisine,
    record.catalog.occasion,
    record.catalog.main,
    record.catalog.base,
    ...record.catalog.keywords,
    ...record.recipe.ingredients.map((item) => item.name),
    ...record.recipe.instructions
  ].join(" "));
}

function scoreRecipe(record: CatalogRecipeRecord, query: CatalogQuery) {
  const text = recordText(record);
  let score = 0;

  for (const term of terms(query.cuisinePreference)) {
    if (text.includes(term)) score += 18;
  }
  for (const term of terms(query.occasion)) {
    if (text.includes(term)) score += 10;
  }
  for (const term of terms(query.mainIngredient)) {
    if (text.includes(term)) score += 22;
  }
  for (const term of terms(query.availableIngredients)) {
    if (text.includes(term)) score += 14;
  }
  for (const term of terms(query.extraNotes)) {
    if (text.includes(term)) score += 4;
  }
  if (query.servings && record.recipe.servings === Number(query.servings)) {
    score += 8;
  }
  if (query.variationOf?.kosherType === record.recipe.kosherType) {
    score += 6;
  }
  if (query.variationOf?.title && record.recipe.title !== query.variationOf.title) {
    score += 3;
  }

  return score;
}

export function listCatalogRecipes() {
  return catalogRecipes;
}

export function findCatalogRecipeById(id: string) {
  return catalogRecipes.find((record) => record.id === id);
}

export function searchCatalogRecipes(query: CatalogQuery = {}, limit = 24) {
  return [...catalogRecipes]
    .map((record) => ({ record, score: scoreRecipe(record, query) }))
    .sort((a, b) => b.score - a.score || a.record.recipe.title.localeCompare(b.record.recipe.title))
    .slice(0, limit)
    .map(({ record }) => record);
}

export function findBestCatalogRecipe(query: CatalogQuery = {}) {
  return searchCatalogRecipes(query, 1)[0];
}

export function pickRandomCatalogRecipe(query: CatalogQuery = {}, poolSize = 30) {
  const pool = searchCatalogRecipes(query, poolSize);
  if (pool.length === 0) return undefined;
  return pool[Math.floor(Math.random() * pool.length)];
}
