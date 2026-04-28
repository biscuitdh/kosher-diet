import { resolveCatalogRecipeImagePath } from "@/lib/catalog-images";
import { selectRecipeImageAsset } from "@/lib/recipe-images";
import {
  FIXED_SAFETY_PROFILE,
  recipeRecordSchema,
  recipeSchema,
  COOKING_DEVICE_LABELS,
  type CookingDevice,
  type GenerationRequest,
  type KosherType,
  type Recipe,
  type RecipeIngredient,
  type RecipeRecord,
  type ShoppingStore
} from "@/lib/schemas";
import { validateRecipeSafety } from "@/lib/validators/forbidden-ingredients";

const CATALOG_SIZE = 1000;
const CREATED_AT = "2026-04-26T00:00:00.000Z";

type ConcreteCookingDevice = Exclude<CookingDevice, "any">;

type CatalogMeta = {
  cuisine: string;
  occasion: string;
  main: string;
  base: string;
  imageKey: string;
  kosherForPassover: boolean;
  primaryCookingDevice: ConcreteCookingDevice;
  compatibleCookingDevices: ConcreteCookingDevice[];
  cookingMethod: string;
  keywords: string[];
};

type IngredientTemplate = {
  title: string;
  ingredient: string;
  quantity: string;
  unit: string;
  calories: number;
  shoppingName: string;
  pantryStaple?: boolean;
  preferredStores?: ShoppingStore[];
  shoppingUrlOverrides?: RecipeIngredient["shoppingUrlOverrides"];
  substitutionNote?: string;
};

type MainTemplate = IngredientTemplate & {
  kosherType: KosherType;
  family: "meat" | "fish" | "eggs" | "soy" | "legume" | "vegetable" | "dairy" | "nuts";
};

export type CatalogRecipeRecord = RecipeRecord & {
  catalog: CatalogMeta;
};

export type CatalogQuery = Partial<
  Pick<
    GenerationRequest,
    | "recipeName"
    | "occasion"
    | "cuisinePreference"
    | "mainIngredient"
    | "availableIngredients"
    | "servings"
    | "kosherForPassover"
    | "cookingDevice"
    | "maxCaloriesPerServing"
    | "maxTotalTimeMinutes"
    | "variationOf"
  >
>;

const cuisines = [
  { name: "Mediterranean", prefix: "Mediterranean", flavors: ["lemon", "parsley", "oregano"] },
  { name: "Sephardi", prefix: "Sephardi", flavors: ["cumin", "coriander", "turmeric"] },
  { name: "Ashkenazi", prefix: "Ashkenazi", flavors: ["dill", "caraway", "onion"] },
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

const meatStores: ShoppingStore[] = ["kosh", "grow-and-behold", "kol-foods", "walmart", "wegmans"];
const fishStores: ShoppingStore[] = ["walmart", "wegmans", "kosh"];
const groceryStores: ShoppingStore[] = ["walmart", "wegmans"];
const specialtyStores: ShoppingStore[] = ["wegmans", "walmart", "specialty-kosher"];
const passoverStores: ShoppingStore[] = ["kosh", "walmart", "wegmans"];

const mains: MainTemplate[] = [
  {
    title: "Kosher Chicken Thighs",
    ingredient: "Kosher boneless chicken thighs (meat)",
    quantity: "12",
    unit: "oz",
    calories: 620,
    kosherType: "meat",
    family: "meat",
    shoppingName: "kosher boneless chicken thighs",
    preferredStores: meatStores,
    shoppingUrlOverrides: {
      kosh: "https://www.kosh.com/poultry/kosher-chicken/dark-meat-chicken.html",
      "grow-and-behold": "https://www.growandbehold.com/poultry/chicken",
      "kol-foods": "https://kolfoods.com/chicken/"
    },
    substitutionNote: "Use kosher chicken breast if thighs are unavailable."
  },
  {
    title: "Kosher Chicken Breast",
    ingredient: "Kosher chicken breast (meat)",
    quantity: "12",
    unit: "oz",
    calories: 560,
    kosherType: "meat",
    family: "meat",
    shoppingName: "kosher chicken breast",
    preferredStores: meatStores,
    shoppingUrlOverrides: {
      kosh: "https://www.kosh.com/chicken-breast-filets.html",
      "grow-and-behold": "https://www.growandbehold.com/poultry/chicken",
      "kol-foods": "https://kolfoods.com/chicken/"
    }
  },
  {
    title: "Kosher Ground Beef",
    ingredient: "Kosher ground beef (meat)",
    quantity: "12",
    unit: "oz",
    calories: 680,
    kosherType: "meat",
    family: "meat",
    shoppingName: "kosher ground beef",
    preferredStores: meatStores,
    shoppingUrlOverrides: {
      kosh: "https://www.kosh.com/kosh-ground-beef-blend-pc-lb-13132.html",
      "grow-and-behold": "https://www.growandbehold.com/ground-beef/",
      "kol-foods": "https://kolfoods.com/beef/"
    }
  },
  {
    title: "Kosher Beef Stew Meat",
    ingredient: "Kosher beef stew meat (meat)",
    quantity: "12",
    unit: "oz",
    calories: 640,
    kosherType: "meat",
    family: "meat",
    shoppingName: "kosher beef stew meat",
    preferredStores: meatStores,
    shoppingUrlOverrides: {
      kosh: "https://www.kosh.com/kosh-stew-meat-11512.html",
      "grow-and-behold": "https://www.growandbehold.com/beef/",
      "kol-foods": "https://kolfoods.com/beef/"
    }
  },
  {
    title: "Kosher Lamb Cubes",
    ingredient: "Kosher lamb cubes (meat)",
    quantity: "12",
    unit: "oz",
    calories: 720,
    kosherType: "meat",
    family: "meat",
    shoppingName: "kosher lamb cubes",
    preferredStores: meatStores,
    shoppingUrlOverrides: {
      kosh: "https://www.kosh.com/meat.html",
      "grow-and-behold": "https://www.growandbehold.com/lamb/",
      "kol-foods": "https://kolfoods.com/lamb/"
    }
  },
  {
    title: "Kosher Duck Breast",
    ingredient: "Kosher duck breast (meat)",
    quantity: "10",
    unit: "oz",
    calories: 650,
    kosherType: "meat",
    family: "meat",
    shoppingName: "kosher duck breast",
    preferredStores: ["kosh", "kol-foods", "specialty-kosher"],
    shoppingUrlOverrides: {
      kosh: "https://www.kosh.com/meat.html",
      "kol-foods": "https://kolfoods.com/duck/"
    },
    substitutionNote: "Use kosher chicken thighs for a simpler weeknight swap."
  },
  {
    title: "Atlantic Salmon",
    ingredient: "Atlantic salmon fillets (parve)",
    quantity: "12",
    unit: "oz",
    calories: 560,
    kosherType: "parve",
    family: "fish",
    shoppingName: "Atlantic salmon fillets",
    preferredStores: fishStores,
    shoppingUrlOverrides: {
      kosh: "https://www.kosh.com/atlantic-salmon-fillet-skin-on-oz-10122.html",
      "kol-foods": "https://kolfoods.com/salmon/"
    }
  },
  {
    title: "Cod Fillets",
    ingredient: "Cod fillets (parve)",
    quantity: "12",
    unit: "oz",
    calories: 280,
    kosherType: "parve",
    family: "fish",
    shoppingName: "cod fillets",
    preferredStores: fishStores
  },
  {
    title: "Walleye Fillets",
    ingredient: "Walleye fillets (parve)",
    quantity: "12",
    unit: "oz",
    calories: 310,
    kosherType: "parve",
    family: "fish",
    shoppingName: "walleye fillets",
    preferredStores: fishStores,
    shoppingUrlOverrides: {
      kosh: "https://www.kosh.com/kosher-fish.html"
    },
    substitutionNote: "Buy skin-on or reliably identified walleye when possible; kosher fish identification still matters."
  },
  {
    title: "Trout Fillets",
    ingredient: "Trout fillets (parve)",
    quantity: "12",
    unit: "oz",
    calories: 510,
    kosherType: "parve",
    family: "fish",
    shoppingName: "trout fillets",
    preferredStores: fishStores
  },
  {
    title: "Tuna Steaks",
    ingredient: "Tuna steaks (parve)",
    quantity: "12",
    unit: "oz",
    calories: 410,
    kosherType: "parve",
    family: "fish",
    shoppingName: "tuna steaks",
    preferredStores: ["wegmans", "walmart", "kosh"],
    shoppingUrlOverrides: {
      kosh: "https://www.kosh.com/kosher-fish.html"
    }
  },
  {
    title: "Large Eggs",
    ingredient: "Large eggs (parve)",
    quantity: "4",
    unit: "large",
    calories: 280,
    kosherType: "parve",
    family: "eggs",
    shoppingName: "large eggs",
    preferredStores: groceryStores
  },
  {
    title: "Extra-Firm Tofu",
    ingredient: "Extra-firm tofu (parve)",
    quantity: "14",
    unit: "oz",
    calories: 420,
    kosherType: "parve",
    family: "soy",
    shoppingName: "extra firm tofu",
    preferredStores: groceryStores
  },
  {
    title: "Red Lentils",
    ingredient: "Red lentils (parve)",
    quantity: "1",
    unit: "cup",
    calories: 680,
    kosherType: "parve",
    family: "legume",
    shoppingName: "red lentils",
    preferredStores: groceryStores
  },
  {
    title: "Chickpeas",
    ingredient: "Chickpeas (parve)",
    quantity: "2",
    unit: "cups",
    calories: 540,
    kosherType: "parve",
    family: "legume",
    shoppingName: "canned chickpeas",
    preferredStores: groceryStores
  },
  {
    title: "Cremini Mushrooms",
    ingredient: "Cremini mushrooms (parve)",
    quantity: "12",
    unit: "oz",
    calories: 80,
    kosherType: "parve",
    family: "vegetable",
    shoppingName: "cremini mushrooms",
    preferredStores: groceryStores
  },
  {
    title: "Sweet Potatoes",
    ingredient: "Sweet potatoes (parve)",
    quantity: "2",
    unit: "medium",
    calories: 260,
    kosherType: "parve",
    family: "vegetable",
    shoppingName: "sweet potatoes",
    preferredStores: groceryStores
  },
  {
    title: "Feta Cheese",
    ingredient: "Feta cheese (dairy)",
    quantity: "5",
    unit: "oz",
    calories: 400,
    kosherType: "dairy",
    family: "dairy",
    shoppingName: "kosher feta cheese",
    preferredStores: ["wegmans", "walmart", "specialty-kosher"]
  },
  {
    title: "Greek Yogurt",
    ingredient: "Plain Greek yogurt (dairy)",
    quantity: "1",
    unit: "cup",
    calories: 180,
    kosherType: "dairy",
    family: "dairy",
    shoppingName: "plain Greek yogurt",
    preferredStores: groceryStores
  },
  {
    title: "Almonds",
    ingredient: "Sliced almonds (parve)",
    quantity: "1/2",
    unit: "cup",
    calories: 320,
    kosherType: "parve",
    family: "nuts",
    shoppingName: "sliced almonds",
    preferredStores: groceryStores
  }
];

const bases: IngredientTemplate[] = [
  {
    title: "Quinoa",
    ingredient: "Quinoa (parve)",
    quantity: "2/3",
    unit: "cup",
    calories: 420,
    shoppingName: "certified kosher for Passover quinoa",
    preferredStores: passoverStores,
    shoppingUrlOverrides: {
      kosh: "https://www.kosh.com/kosher-for-passover.html"
    }
  },
  {
    title: "Kosher for Passover Matzo Farfel",
    ingredient: "Kosher for Passover matzo farfel (parve)",
    quantity: "2",
    unit: "cups",
    calories: 440,
    shoppingName: "kosher for Passover matzo farfel",
    preferredStores: passoverStores,
    shoppingUrlOverrides: {
      kosh: "https://www.kosh.com/kosher-for-passover.html"
    }
  },
  { title: "Basmati Rice", ingredient: "Basmati rice (parve)", quantity: "2/3", unit: "cup", calories: 455, shoppingName: "basmati rice", preferredStores: groceryStores },
  { title: "Brown Rice", ingredient: "Brown rice (parve)", quantity: "2/3", unit: "cup", calories: 455, shoppingName: "brown rice", preferredStores: groceryStores },
  { title: "Israeli Couscous", ingredient: "Israeli couscous (parve)", quantity: "2/3", unit: "cup", calories: 420, shoppingName: "Israeli couscous", preferredStores: groceryStores },
  { title: "Pasta", ingredient: "Pasta (parve)", quantity: "6", unit: "oz", calories: 630, shoppingName: "pasta", preferredStores: groceryStores },
  { title: "Pita", ingredient: "Pita bread (parve)", quantity: "2", unit: "rounds", calories: 330, shoppingName: "pita bread", preferredStores: groceryStores },
  { title: "Buckwheat Groats", ingredient: "Buckwheat groats (parve)", quantity: "2/3", unit: "cup", calories: 390, shoppingName: "buckwheat groats", preferredStores: specialtyStores },
  { title: "Cauliflower Rice", ingredient: "Cauliflower rice (parve)", quantity: "3", unit: "cups", calories: 90, shoppingName: "cauliflower rice", preferredStores: groceryStores }
];

const vegetableSets = [
  { title: "Carrots and Zucchini", calories: 95, items: ["Carrots (parve)", "Zucchini (parve)", "Yellow onions (parve)"], shopping: ["carrots", "zucchini", "yellow onions"] },
  { title: "Fennel and Celery", calories: 80, items: ["Fennel bulb (parve)", "Celery (parve)", "Carrots (parve)"], shopping: ["fennel bulb", "celery", "carrots"] },
  { title: "Squash and Kale", calories: 140, items: ["Butternut squash (parve)", "Kale (parve)", "Yellow onions (parve)"], shopping: ["butternut squash", "kale", "yellow onions"] },
  { title: "Cabbage and Mushrooms", calories: 85, items: ["Green cabbage (parve)", "Cremini mushrooms (parve)", "Carrots (parve)"], shopping: ["green cabbage", "cremini mushrooms", "carrots"] },
  { title: "Green Beans and Leeks", calories: 90, items: ["Green beans (parve)", "Leeks (parve)", "Carrots (parve)"], shopping: ["green beans", "leeks", "carrots"] },
  { title: "Beets and Parsnips", calories: 160, items: ["Beets (parve)", "Parsnips (parve)", "Carrots (parve)"], shopping: ["beets", "parsnips", "carrots"] },
  { title: "Broccoli and Cauliflower", calories: 105, items: ["Broccoli florets (parve)", "Cauliflower florets (parve)", "Yellow onions (parve)"], shopping: ["broccoli florets", "cauliflower florets", "yellow onions"] },
  { title: "Mushrooms and Leeks", calories: 75, items: ["Cremini mushrooms (parve)", "Leeks (parve)", "Celery (parve)"], shopping: ["cremini mushrooms", "leeks", "celery"] }
] as const;

const flavorSets = [
  { title: "Lemon Herb", calories: 12, items: ["Lemon juice (parve)", "Fresh parsley (parve)", "Garlic cloves (parve)"], shopping: ["lemons", "fresh parsley", "garlic"] },
  { title: "Cumin Turmeric", calories: 18, items: ["Ground cumin (parve)", "Ground turmeric (parve)", "Ground coriander (parve)"], shopping: ["ground cumin", "ground turmeric", "ground coriander"] },
  { title: "Dill Lemon", calories: 12, items: ["Fresh dill (parve)", "Lemon zest (parve)", "Garlic cloves (parve)"], shopping: ["fresh dill", "lemons", "garlic"] },
  { title: "Ginger Cinnamon", calories: 18, items: ["Fresh ginger (parve)", "Ground cinnamon (parve)", "Ground coriander (parve)"], shopping: ["fresh ginger", "ground cinnamon", "ground coriander"] },
  { title: "Rosemary Thyme", calories: 10, items: ["Fresh rosemary (parve)", "Fresh thyme (parve)", "Garlic cloves (parve)"], shopping: ["fresh rosemary", "fresh thyme", "garlic"] },
  { title: "Sumac Parsley", calories: 14, items: ["Ground sumac (parve)", "Fresh parsley (parve)", "Lemon juice (parve)"], shopping: ["ground sumac", "fresh parsley", "lemons"] },
  { title: "Cardamom Cumin", calories: 16, items: ["Ground cardamom (parve)", "Ground cumin (parve)", "Garlic cloves (parve)"], shopping: ["ground cardamom", "ground cumin", "garlic"] },
  { title: "Mint Lime", calories: 12, items: ["Fresh mint (parve)", "Lime juice (parve)", "Ground coriander (parve)"], shopping: ["fresh mint", "limes", "ground coriander"] },
  { title: "Garlic Oregano", calories: 10, items: ["Garlic cloves (parve)", "Dried oregano (parve)", "Lemon juice (parve)"], shopping: ["garlic", "dried oregano", "lemons"] },
  { title: "Caraway Dill", calories: 14, items: ["Caraway seeds (parve)", "Fresh dill (parve)", "Apple cider vinegar (parve)"], shopping: ["caraway seeds", "fresh dill", "apple cider vinegar"] },
  { title: "Tahini Lemon", calories: 180, items: ["Tahini (parve)", "Lemon juice (parve)", "Garlic cloves (parve)"], shopping: ["tahini", "lemons", "garlic"] }
] as const;

const PASSOVER_WALLEYE_INDEXES = new Set(Array.from({ length: 24 }, (_, index) => 80 + index * 32));
const passoverBaseTitles = new Set(["Quinoa", "Kosher for Passover Matzo Farfel", "Cauliflower Rice"]);
const passoverFlavorTitles = new Set([
  "Lemon Herb",
  "Cumin Turmeric",
  "Dill Lemon",
  "Ginger Cinnamon",
  "Rosemary Thyme",
  "Sumac Parsley",
  "Mint Lime",
  "Garlic Oregano"
]);
const passoverVegetableTitles = new Set([
  "Carrots and Zucchini",
  "Fennel and Celery",
  "Squash and Kale",
  "Cabbage and Mushrooms",
  "Beets and Parsnips",
  "Broccoli and Cauliflower",
  "Mushrooms and Leeks"
]);

const passoverBases = bases.filter((base) => passoverBaseTitles.has(base.title));
const passoverFlavors = flavorSets.filter((flavor) => passoverFlavorTitles.has(flavor.title));
const passoverVegetableSets = vegetableSets.filter((vegetables) => passoverVegetableTitles.has(vegetables.title));
const walleyeMain = mains.find((main) => main.title === "Walleye Fillets");

const STRICT_PASSOVER_FORBIDDEN_PATTERNS = [
  /\b(?:wheat|barley|rye|oats?|spelt|farro|bulgur|seitan|flour)\b/i,
  /\b(?:bread|pasta|pita|couscous)\b/i,
  /\b(?:rice|corn|beans?|lentils?|chickpeas?|peas?|soy|soybeans?|tofu|edamame)\b/i,
  /\b(?:buckwheat|kasha|millet|mustard|sesame|tahini|sunflower|poppy|rapeseed|teff)\b/i,
  /\b(?:caraway|cardamom|fennel seed|fennel seeds|fenugreek|hemp|sorghum)\b/i
];

function passoverText(recipe: Recipe) {
  return [
    recipe.title,
    recipe.notes,
    ...recipe.ingredients.flatMap((item) => [item.name, item.shoppingName ?? "", item.substitutionNote ?? ""]),
    ...recipe.instructions
  ]
    .join(" ")
    .replace(/\bcauliflower rice\b/gi, "cauliflower crumble");
}

export function isStrictKosherForPassoverRecipe(recipe: Recipe) {
  const text = passoverText(recipe);
  return !STRICT_PASSOVER_FORBIDDEN_PATTERNS.some((pattern) => pattern.test(text));
}

type MethodContext = {
  base: IngredientTemplate;
  vegetables: (typeof vegetableSets)[number];
  flavor: (typeof flavorSets)[number];
  main: MainTemplate;
};

type MethodProfile = {
  compatibleCookingDevices: ConcreteCookingDevice[];
  familyFit: MainTemplate["family"][];
  cookTime: (main: MainTemplate, index: number) => number;
  instructions: [((context: MethodContext) => string[]), ((context: MethodContext) => string[])];
};

const methodProfiles: Record<ConcreteCookingDevice, MethodProfile> = {
  pan: {
    compatibleCookingDevices: ["pan"],
    familyFit: ["fish", "eggs", "vegetable", "dairy", "nuts", "meat", "soy"],
    cookTime: (main, index) => (main.family === "meat" ? 22 + (index % 4) * 4 : main.family === "fish" ? 12 + (index % 4) * 3 : 14 + (index % 4) * 3),
    instructions: [
      ({ base, vegetables, flavor, main }) => [
        `Prepare the ${base.title.toLowerCase()} according to package directions, using water and a pinch of kosher salt.`,
        `Heat olive oil in a wide skillet, then saute the ${vegetables.title.toLowerCase()} until glossy and just tender.`,
        `Add the ${main.title.toLowerCase()} with the ${flavor.title.toLowerCase()} seasonings; sear and turn until safely done.`,
        "Fold in the cooked base, taste for salt, and rest for five minutes so the flavors settle.",
        "Finish with the fresh herb or citrus from the ingredient list and serve warm."
      ],
      ({ base, vegetables, flavor, main }) => [
        `Cook the ${base.title.toLowerCase()} with water and kosher salt until ready to fold through.`,
        `Set a skillet over medium heat with olive oil, then soften the ${vegetables.title.toLowerCase()} in an even layer.`,
        `Nestle in the ${main.title.toLowerCase()}, sprinkle with ${flavor.title.toLowerCase()} seasonings, and pan-cook until safely done.`,
        "Stir the base through the skillet juices and let everything stand briefly off heat.",
        "Adjust salt, brighten with the listed herb or citrus, and serve warm."
      ]
    ]
  },
  oven: {
    compatibleCookingDevices: ["oven"],
    familyFit: ["fish", "meat", "vegetable", "dairy", "nuts", "soy", "eggs"],
    cookTime: (main, index) => (main.family === "meat" ? 30 + (index % 4) * 5 : main.family === "fish" ? 16 + (index % 3) * 4 : 22 + (index % 4) * 4),
    instructions: [
      ({ base, vegetables, flavor, main }) => [
        `Prepare the ${base.title.toLowerCase()} with water and kosher salt while the oven heats to 400 F.`,
        `Toss the ${vegetables.title.toLowerCase()} with olive oil and spread on a parchment-lined sheet pan.`,
        `Season the ${main.title.toLowerCase()} with ${flavor.title.toLowerCase()}, add it to the pan, and roast until safely done.`,
        "Fold the roasted vegetables and pan juices through the cooked base.",
        "Rest for five minutes, finish with the listed herb or citrus, and serve warm."
      ],
      ({ base, vegetables, flavor, main }) => [
        `Cook the ${base.title.toLowerCase()} separately with water and kosher salt.`,
        `Arrange the ${vegetables.title.toLowerCase()} and ${main.title.toLowerCase()} in a shallow baking dish with olive oil.`,
        `Dust with ${flavor.title.toLowerCase()} seasonings, bake until tender and safely cooked, then let the dish settle.`,
        "Spoon the baked mixture over the base and fold gently.",
        "Taste for salt, add the fresh finish from the ingredient list, and serve warm."
      ]
    ]
  },
  "slow-cooker": {
    compatibleCookingDevices: ["slow-cooker"],
    familyFit: ["meat", "legume", "vegetable"],
    cookTime: (main, index) => (main.family === "meat" ? 180 + (index % 4) * 30 : 120 + (index % 3) * 20),
    instructions: [
      ({ base, vegetables, flavor, main }) => [
        `Prepare the ${base.title.toLowerCase()} separately near serving time with water and kosher salt.`,
        `Layer the ${vegetables.title.toLowerCase()} in the crock pot with olive oil and the ${flavor.title.toLowerCase()} seasonings.`,
        `Add the ${main.title.toLowerCase()}, cover, and slow cook until tender and safely done.`,
        "Fold the warm base into the slow-cooker juices just before serving.",
        "Taste for salt, finish with the listed herb or citrus, and serve warm."
      ],
      ({ base, vegetables, flavor, main }) => [
        `Cook the ${base.title.toLowerCase()} separately so it stays distinct.`,
        `Combine olive oil, ${vegetables.title.toLowerCase()}, ${main.title.toLowerCase()}, and ${flavor.title.toLowerCase()} seasonings in the crock pot.`,
        "Cover and braise on low until the main ingredient is tender and safely done.",
        "Spoon the saucy mixture over the cooked base and rest for five minutes.",
        "Adjust salt and finish with the fresh herb or citrus from the ingredient list."
      ]
    ]
  },
  "air-fryer": {
    compatibleCookingDevices: ["air-fryer"],
    familyFit: ["fish", "meat", "vegetable", "soy", "nuts"],
    cookTime: (main, index) => (main.family === "meat" ? 18 + (index % 4) * 3 : main.family === "fish" ? 10 + (index % 3) * 3 : 14 + (index % 4) * 3),
    instructions: [
      ({ base, vegetables, flavor, main }) => [
        `Prepare the ${base.title.toLowerCase()} with water and kosher salt while the air fryer preheats.`,
        `Toss the ${vegetables.title.toLowerCase()} with olive oil and air-fry until lightly crisp at the edges.`,
        `Season the ${main.title.toLowerCase()} with ${flavor.title.toLowerCase()}, then air-fry until browned and safely done.`,
        "Fold the crisped vegetables through the base and set the main ingredient on top.",
        "Finish with the listed herb or citrus and serve warm."
      ],
      ({ base, vegetables, flavor, main }) => [
        `Cook the ${base.title.toLowerCase()} separately with water and kosher salt.`,
        `Coat the ${vegetables.title.toLowerCase()} and ${main.title.toLowerCase()} lightly with olive oil.`,
        `Sprinkle with ${flavor.title.toLowerCase()} seasonings and air-fry in batches until crisp-tender and safely cooked.`,
        "Combine the vegetables with the cooked base and rest briefly.",
        "Taste for salt, add the fresh finish, and serve the air-fried main ingredient alongside."
      ]
    ]
  },
  stovetop: {
    compatibleCookingDevices: ["stovetop"],
    familyFit: ["fish", "eggs", "legume", "soy", "vegetable", "dairy", "meat"],
    cookTime: (main, index) => (main.family === "meat" ? 26 + (index % 4) * 4 : main.family === "fish" ? 15 + (index % 4) * 3 : 18 + (index % 4) * 3),
    instructions: [
      ({ base, vegetables, flavor, main }) => [
        `Simmer the ${base.title.toLowerCase()} with water and kosher salt until tender.`,
        `Warm olive oil in a heavy pot, then cook the ${vegetables.title.toLowerCase()} until fragrant and tender.`,
        `Stir in the ${main.title.toLowerCase()} and ${flavor.title.toLowerCase()} seasonings; simmer gently until safely done.`,
        "Fold the base into the pot and let it absorb the seasoned cooking juices.",
        "Finish with the listed herb or citrus and serve warm."
      ],
      ({ base, vegetables, flavor, main }) => [
        `Start the ${base.title.toLowerCase()} in a covered stovetop pot with water and kosher salt.`,
        `In a second pot, soften the ${vegetables.title.toLowerCase()} with olive oil.`,
        `Add the ${main.title.toLowerCase()} and ${flavor.title.toLowerCase()} seasonings, then pot-cook until safely done.`,
        "Combine with the base and rest covered for five minutes.",
        "Adjust salt, brighten with the listed fresh finish, and serve warm."
      ]
    ]
  },
  "instant-pot": {
    compatibleCookingDevices: ["instant-pot"],
    familyFit: ["meat", "legume", "soy", "vegetable"],
    cookTime: (main, index) => (main.family === "meat" ? 34 + (index % 4) * 4 : 18 + (index % 4) * 3),
    instructions: [
      ({ base, vegetables, flavor, main }) => [
        `Prepare the ${base.title.toLowerCase()} separately with water and kosher salt.`,
        `Use the Instant Pot saute setting to warm olive oil and soften the ${vegetables.title.toLowerCase()}.`,
        `Add the ${main.title.toLowerCase()}, ${flavor.title.toLowerCase()} seasonings, and a splash of water, then pressure cook until safely done.`,
        "Release pressure according to the appliance instructions and rest the mixture for five minutes.",
        "Fold with the cooked base, adjust salt, finish with the listed herb or citrus, and serve warm."
      ],
      ({ base, vegetables, flavor, main }) => [
        `Cook the ${base.title.toLowerCase()} separately so it keeps its texture.`,
        `Saute the ${vegetables.title.toLowerCase()} in olive oil in the Instant Pot insert.`,
        `Stir in the ${main.title.toLowerCase()} and ${flavor.title.toLowerCase()} seasonings, then pressure cook until tender and safely done.`,
        "Let pressure release, then spoon the seasoned mixture over the cooked base.",
        "Rest briefly, taste for salt, and add the fresh finish from the ingredient list."
      ]
    ]
  }
};

const devicesByFamily: Record<MainTemplate["family"], ConcreteCookingDevice[]> = {
  meat: ["slow-cooker", "instant-pot", "oven", "pan", "air-fryer", "stovetop", "slow-cooker"],
  fish: ["pan", "oven", "air-fryer", "stovetop"],
  eggs: ["pan", "stovetop", "oven"],
  soy: ["stovetop", "air-fryer", "pan", "oven", "instant-pot"],
  legume: ["slow-cooker", "instant-pot", "stovetop", "slow-cooker"],
  vegetable: ["stovetop", "oven", "air-fryer", "pan", "instant-pot", "slow-cooker", "slow-cooker"],
  dairy: ["pan", "oven", "stovetop"],
  nuts: ["oven", "pan", "air-fryer"]
};

const passoverDevicesByFamily: Partial<Record<MainTemplate["family"], ConcreteCookingDevice[]>> = {
  meat: ["slow-cooker", "instant-pot", "oven", "pan", "air-fryer", "stovetop", "slow-cooker", "instant-pot"],
  vegetable: ["slow-cooker", "instant-pot", "oven", "air-fryer", "stovetop", "pan"],
  fish: ["pan", "oven", "air-fryer", "stovetop"],
  eggs: ["pan", "stovetop", "oven"],
  dairy: ["pan", "oven", "stovetop"],
  nuts: ["oven", "pan", "air-fryer"]
};

function methodForRecipe(index: number, main: MainTemplate, passoverCandidate: boolean) {
  const devices = (passoverCandidate && passoverDevicesByFamily[main.family]) || devicesByFamily[main.family];
  const primaryCookingDevice = devices[(index + Math.floor(index / mains.length)) % devices.length];
  const profile = methodProfiles[primaryCookingDevice];
  if (!profile.familyFit.includes(main.family)) {
    throw new Error(`Unsupported ${primaryCookingDevice} catalog method for ${main.family}`);
  }

  return {
    primaryCookingDevice,
    compatibleCookingDevices: profile.compatibleCookingDevices,
    cookingMethod: COOKING_DEVICE_LABELS[primaryCookingDevice],
    profile,
    variant: Math.floor(index / devices.length) % profile.instructions.length
  };
}

function isPassoverCandidate(main: MainTemplate, base: IngredientTemplate, vegetables: (typeof vegetableSets)[number], flavor: (typeof flavorSets)[number]) {
  return (
    !["soy", "legume"].includes(main.family) &&
    passoverBaseTitles.has(base.title) &&
    passoverVegetableTitles.has(vegetables.title) &&
    passoverFlavorTitles.has(flavor.title)
  );
}

function ingredient(template: IngredientTemplate): RecipeIngredient {
  return {
    name: template.ingredient,
    quantity: template.quantity,
    unit: template.unit,
    shoppingName: template.shoppingName,
    pantryStaple: template.pantryStaple,
    preferredStores: template.preferredStores,
    shoppingUrlOverrides: template.shoppingUrlOverrides,
    substitutionNote: template.substitutionNote
  };
}

function simpleIngredient(
  name: string,
  quantity: string,
  unit: string,
  shoppingName: string,
  preferredStores: ShoppingStore[] = groceryStores,
  calories = 0,
  pantryStaple = false
): IngredientTemplate {
  return { title: shoppingName, ingredient: name, quantity, unit, calories, shoppingName, preferredStores, pantryStaple };
}

function buildRecipe(index: number): CatalogRecipeRecord {
  const isGuaranteedPassoverWalleye = PASSOVER_WALLEYE_INDEXES.has(index);
  let main = mains[index % mains.length];
  const cuisine = cuisines[(index + Math.floor(index / mains.length)) % cuisines.length];
  const occasion = occasions[Math.floor(index / cuisines.length) % occasions.length];
  let base = bases[(index * 5) % bases.length];
  let vegetables = vegetableSets[(index * 3) % vegetableSets.length];
  let flavor = flavorSets[(index * 5) % flavorSets.length];

  if (isGuaranteedPassoverWalleye && walleyeMain) {
    main = walleyeMain;
    base = passoverBases[index % passoverBases.length];
    vegetables = passoverVegetableSets[index % passoverVegetableSets.length];
    flavor = passoverFlavors[index % passoverFlavors.length];
  }
  const method = methodForRecipe(index, main, isPassoverCandidate(main, base, vegetables, flavor));
  const prepTimeMinutes = 8 + (index % 4) * 3;
  const cookTimeMinutes = method.profile.cookTime(main, index);
  const title = `${cuisine.prefix} ${flavor.title} ${main.title} with ${base.title} and ${vegetables.title}`;
  const oil = simpleIngredient("Extra virgin olive oil (parve)", "1 1/2", "tbsp", "extra virgin olive oil", groceryStores, 180, true);
  const salt = simpleIngredient("Kosher salt (parve)", "3/4", "tsp", "kosher salt", groceryStores, 0, true);
  const water = simpleIngredient("Water (parve)", "1 1/2", "cups", "water", [], 0, true);
  const vegetableIngredients = vegetables.items.map((item, itemIndex) =>
    simpleIngredient(item, itemIndex === 0 ? "1" : "1/2", itemIndex === 0 ? "cup" : "cup", vegetables.shopping[itemIndex] ?? item.replace(/\([^)]*\)/g, "").trim())
  );
  const flavorIngredients = flavor.items.map((item, itemIndex) =>
    simpleIngredient(item, itemIndex === 0 ? "1 1/2" : "1", itemIndex === 0 ? "tsp" : "tbsp", flavor.shopping[itemIndex] ?? item.replace(/\([^)]*\)/g, "").trim())
  );
  const estimatedCaloriesPerServing = Math.round((main.calories + base.calories + vegetables.calories + flavor.calories + oil.calories) / 2 / 10) * 10;
  const instructions = method.profile.instructions[method.variant]({ base, vegetables, flavor, main });

  const recipe: Recipe = recipeSchema.parse({
    title,
    kosherType: main.kosherType,
    ingredients: [
      ingredient(main),
      ingredient(base),
      ...vegetableIngredients.map(ingredient),
      ...flavorIngredients.map(ingredient),
      ingredient(oil),
      ingredient(salt),
      ingredient(water)
    ],
    instructions,
    prepTimeMinutes,
    cookTimeMinutes,
    servings: 2,
    estimatedCaloriesPerServing,
    notes: `${occasion} recipe for two. ${cuisine.name} style, nightshade-free, tomato-free, kosher, and built from Walmart/Wegmans-friendly ingredients with specialty kosher sourcing where it helps.`
  });

  const safety = validateRecipeSafety(recipe, FIXED_SAFETY_PROFILE);
  if (!safety.ok) {
    throw new Error(`Unsafe catalog recipe ${index}: ${recipe.title} ${safety.issues.map((issue) => issue.reason).join(", ")}`);
  }
  const kosherForPassover = isStrictKosherForPassoverRecipe(recipe);
  const recipeImage = selectRecipeImageAsset({
    mainTitle: main.title,
    mainFamily: main.family,
    baseTitle: base.title,
    flavorTitle: flavor.title,
    kosherForPassover,
    index
  });

  const id = `catalog-${String(index + 1).padStart(4, "0")}`;
  const baseRecord = recipeRecordSchema.parse({
    id,
    recipe,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    imagePath: resolveCatalogRecipeImagePath(id, recipeImage.path),
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
      imageKey: recipeImage.key,
      kosherForPassover,
      primaryCookingDevice: method.primaryCookingDevice,
      compatibleCookingDevices: method.compatibleCookingDevices,
      cookingMethod: method.cookingMethod,
      keywords: [
        cuisine.name,
        cuisine.prefix,
        occasion,
        method.primaryCookingDevice,
        method.cookingMethod,
        ...method.compatibleCookingDevices,
        kosherForPassover ? "kosher for passover" : "",
        kosherForPassover ? "pesach" : "",
        kosherForPassover ? "no kitniyot" : "",
        main.title,
        main.family,
        main.ingredient,
        main.shoppingName,
        base.title,
        base.ingredient,
        base.shoppingName,
        vegetables.title,
        ...vegetables.items,
        ...vegetables.shopping,
        flavor.title,
        ...flavor.items,
        ...flavor.shopping,
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
    .filter((term) => term.length >= 3 && !["and", "with", "the", "for", "want", "include", "recipe"].includes(term));
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
    record.catalog.cookingMethod,
    record.catalog.primaryCookingDevice,
    ...record.catalog.compatibleCookingDevices,
    ...record.catalog.keywords,
    ...record.recipe.ingredients.flatMap((item) => [item.name, item.shoppingName ?? "", item.substitutionNote ?? ""]),
    ...record.recipe.instructions
  ].join(" "));
}

function titleScore(record: CatalogRecipeRecord, recipeName?: string) {
  const query = normalize(recipeName);
  if (!query) return 0;
  const title = normalize(record.recipe.title);
  if (title === query) return 1000;
  if (title.includes(query)) return 700;
  return terms(recipeName).reduce((score, term) => score + (title.includes(term) ? 32 : 0), 0);
}

function isConcreteCookingDevice(device?: CookingDevice): device is ConcreteCookingDevice {
  return Boolean(device && device !== "any");
}

function isDeviceCompatible(record: CatalogRecipeRecord, device: ConcreteCookingDevice) {
  return record.catalog.compatibleCookingDevices.includes(device);
}

const nearCookingDevices: Record<ConcreteCookingDevice, ConcreteCookingDevice[]> = {
  pan: ["stovetop", "oven"],
  oven: ["air-fryer", "pan"],
  "slow-cooker": ["instant-pot", "stovetop"],
  "air-fryer": ["oven", "pan"],
  stovetop: ["pan", "instant-pot"],
  "instant-pot": ["slow-cooker", "stovetop"]
};

function scoreRecipe(record: CatalogRecipeRecord, query: CatalogQuery) {
  const text = recordText(record);
  let score = titleScore(record, query.recipeName);

  for (const term of terms(query.cuisinePreference)) {
    if (text.includes(term)) score += 34;
  }
  for (const term of terms(query.occasion)) {
    if (text.includes(term)) score += 10;
  }
  for (const term of terms(query.mainIngredient)) {
    if (text.includes(term)) score += 56;
  }
  for (const term of terms(query.availableIngredients)) {
    if (text.includes(term)) score += 14;
  }
  if (isConcreteCookingDevice(query.cookingDevice)) {
    if (record.catalog.primaryCookingDevice === query.cookingDevice) score += 90;
    else if (isDeviceCompatible(record, query.cookingDevice)) score += 70;
    else if (nearCookingDevices[query.cookingDevice].includes(record.catalog.primaryCookingDevice)) score += 18;

    const deviceLabel = COOKING_DEVICE_LABELS[query.cookingDevice].toLowerCase();
    if (text.includes(deviceLabel)) score += 20;
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

type CatalogSearchOptions = {
  seed?: string | number;
  varyWithinTopMatches?: boolean;
  poolSize?: number;
};

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededNoise(seed: string | number, recordId: string) {
  return stableHash(`${seed}:${recordId}`) / 0xffffffff;
}

function rankedCatalogRecipes(query: CatalogQuery = {}) {
  return catalogRecipes
    .filter((record) => !query.kosherForPassover || record.catalog.kosherForPassover)
    .filter((record) => !query.maxCaloriesPerServing || (record.recipe.estimatedCaloriesPerServing ?? Number.POSITIVE_INFINITY) <= query.maxCaloriesPerServing)
    .filter((record) => !query.maxTotalTimeMinutes || record.recipe.prepTimeMinutes + record.recipe.cookTimeMinutes <= query.maxTotalTimeMinutes)
    .map((record) => ({ record, score: scoreRecipe(record, query) }))
    .sort((a, b) => b.score - a.score || a.record.recipe.title.localeCompare(b.record.recipe.title));
}

function orderForCookingDevice(ranked: ReturnType<typeof rankedCatalogRecipes>, query: CatalogQuery, options: CatalogSearchOptions) {
  if (!isConcreteCookingDevice(query.cookingDevice)) return applyVariety(ranked, query, options);

  const cookingDevice = query.cookingDevice;
  const exactMatches = ranked.filter(({ record }) => isDeviceCompatible(record, cookingDevice));
  const fallbackMatches = ranked.filter(({ record }) => !isDeviceCompatible(record, cookingDevice));

  return [...applyVariety(exactMatches, query, options), ...applyVariety(fallbackMatches, query, options)];
}

function hasExactTitleQuery(query: CatalogQuery, ranked: ReturnType<typeof rankedCatalogRecipes>) {
  const queryTitle = normalize(query.recipeName);
  return Boolean(queryTitle && ranked[0] && normalize(ranked[0].record.recipe.title) === queryTitle);
}

function applyVariety(
  ranked: ReturnType<typeof rankedCatalogRecipes>,
  query: CatalogQuery,
  { seed = "default", poolSize = 12, varyWithinTopMatches = false }: CatalogSearchOptions
) {
  if (!varyWithinTopMatches || ranked.length <= 1 || hasExactTitleQuery(query, ranked)) return ranked;

  const variedPool = ranked.slice(0, poolSize).sort((a, b) => {
    const aWeight = a.score + seededNoise(seed, a.record.id) * 18;
    const bWeight = b.score + seededNoise(seed, b.record.id) * 18;
    return bWeight - aWeight || a.record.recipe.title.localeCompare(b.record.recipe.title);
  });

  return [...variedPool, ...ranked.slice(poolSize)];
}

export function listCatalogRecipes() {
  return catalogRecipes;
}

export function findCatalogRecipeById(id: string) {
  return catalogRecipes.find((record) => record.id === id);
}

export function searchCatalogRecipes(query: CatalogQuery = {}, limit = 24, options: CatalogSearchOptions = {}) {
  return orderForCookingDevice(rankedCatalogRecipes(query), query, options)
    .slice(0, limit)
    .map(({ record }) => record);
}

export function findBestCatalogRecipe(query: CatalogQuery = {}) {
  return searchCatalogRecipes(query, 1)[0];
}

export function findVariedCatalogRecipe(query: CatalogQuery = {}, seed: string | number = Date.now()) {
  return searchCatalogRecipes(query, 1, { seed, varyWithinTopMatches: true, poolSize: 12 })[0];
}

export function pickRandomCatalogRecipe(query: CatalogQuery = {}, poolSize = 30) {
  const pool = searchCatalogRecipes(query, poolSize);
  if (pool.length === 0) return undefined;
  return pool[Math.floor(Math.random() * pool.length)];
}
