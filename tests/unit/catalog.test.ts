import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { isCatalogRecipeImagePath, listCatalogRecipeImageManifest, resolveCatalogRecipeImagePath } from "@/lib/catalog-images";
import {
  findBestCatalogRecipe,
  findCatalogRecipeById,
  findVariedCatalogRecipe,
  listCatalogRecipes,
  searchCatalogRecipes
} from "@/lib/catalog";
import { findRecipeImageAssetByKey, listRecipeImageAssets, rankRecipeImageAssets, type RecipeImageAsset } from "@/lib/recipe-images";
import { COOKING_DEVICE_VALUES, FIXED_SAFETY_PROFILE, recipeSchema, type CookingDevice } from "@/lib/schemas";
import { validateRecipeSafety } from "@/lib/validators/forbidden-ingredients";

const concreteCookingDevices = COOKING_DEVICE_VALUES.filter((device): device is Exclude<CookingDevice, "any"> => device !== "any");

function methodPattern(record: ReturnType<typeof listCatalogRecipes>[number]) {
  return record.recipe.instructions
    .map((step) =>
      step
        .toLowerCase()
        .replace(record.catalog.main.toLowerCase(), "{main}")
        .replace(record.catalog.base.toLowerCase(), "{base}")
        .replace(/\b(?:carrots and zucchini|fennel and celery|squash and kale|cabbage and mushrooms|green beans and leeks|beets and parsnips|broccoli and cauliflower|mushrooms and leeks)\b/g, "{vegetables}")
        .replace(/\b(?:lemon herb|cumin turmeric|dill lemon|ginger cinnamon|rosemary thyme|sumac parsley|cardamom cumin|mint lime|garlic oregano|caraway dill|tahini lemon)\b/g, "{flavor}")
        .replace(/\s+/g, " ")
        .trim()
    )
    .join(" | ");
}

describe("recipe catalog", () => {
  it("contains 1,000 schema-valid recipes", () => {
    const recipes = listCatalogRecipes();

    expect(recipes).toHaveLength(1000);
    for (const record of recipes) {
      expect(() => recipeSchema.parse(record.recipe)).not.toThrow();
    }
  });

  it("keeps every catalog recipe inside the fixed safety profile", () => {
    for (const record of listCatalogRecipes()) {
      expect(validateRecipeSafety(record.recipe, FIXED_SAFETY_PROFILE), record.recipe.title).toMatchObject({ ok: true });
      expect(record.recipe.servings).toBe(2);
      expect(record.recipe.estimatedCaloriesPerServing).toBeGreaterThan(0);
    }
  });

  it("includes at least 50 walleye recipes and ranks walleye searches", () => {
    const walleyeRecipes = listCatalogRecipes().filter((record) => record.recipe.title.toLowerCase().includes("walleye"));
    const [match] = searchCatalogRecipes({ mainIngredient: "walleye", recipeName: "walleye" }, 1);

    expect(walleyeRecipes.length).toBeGreaterThanOrEqual(50);
    expect(match.recipe.title.toLowerCase()).toContain("walleye");
  });

  it("maps catalog recipes to local dish-aware image assets", () => {
    const assets = listRecipeImageAssets();
    const catalogImageManifest = listCatalogRecipeImageManifest();
    const catalogRecipeIds = new Set(listCatalogRecipes().map((record) => record.id));
    const walleyeRecipes = listCatalogRecipes().filter((record) => record.recipe.title.toLowerCase().includes("walleye"));
    const passoverRecipes = listCatalogRecipes().filter((record) => record.catalog.kosherForPassover);

    expect(assets.length).toBeGreaterThanOrEqual(80);
    expect(assets.length).toBeLessThanOrEqual(120);
    expect(Object.keys(catalogImageManifest)).toHaveLength(1000);

    for (const record of listCatalogRecipes()) {
      expect(/^\/images\/recipes\/(?:real|ai|catalog)\//.test(record.imagePath), record.recipe.title).toBe(true);
      expect(existsSync(join(process.cwd(), "public", record.imagePath)), record.imagePath).toBe(true);
      expect(findRecipeImageAssetByKey(record.catalog.imageKey), record.catalog.imageKey).toBeDefined();
      expect(catalogImageManifest[record.id], record.id).toBe(record.imagePath);
    }

    for (const [recipeId, imagePath] of Object.entries(catalogImageManifest)) {
      expect(catalogRecipeIds.has(recipeId), recipeId).toBe(true);
      expect(isCatalogRecipeImagePath(imagePath), imagePath).toBe(true);
      expect(existsSync(join(process.cwd(), "public", imagePath)), imagePath).toBe(true);
    }

    for (const record of walleyeRecipes) {
      const asset = findRecipeImageAssetByKey(record.catalog.imageKey);
      expect(asset?.familyMatches, record.recipe.title).toContain("fish");
      expect(asset?.mainMatches.some((match) => ["walleye", "cod", "trout"].includes(match)), record.recipe.title).toBe(true);
    }

    for (const record of passoverRecipes) {
      const asset = findRecipeImageAssetByKey(record.catalog.imageKey);
      expect(asset?.passoverSafe, record.recipe.title).toBe(true);
    }
  });

  it("prefers exact per-recipe catalog images when present", () => {
    expect(isCatalogRecipeImagePath("/images/recipes/catalog/catalog-0001.webp")).toBe(true);
    expect(isCatalogRecipeImagePath("/images/recipes/ai/walleye.webp")).toBe(false);
    expect(
      resolveCatalogRecipeImagePath("catalog-0001", "/images/recipes/ai/fallback.webp", {
        "catalog-0001": "/images/recipes/catalog/catalog-0001.webp"
      })
    ).toBe("/images/recipes/catalog/catalog-0001.webp");
    expect(
      resolveCatalogRecipeImagePath("catalog-0002", "/images/recipes/ai/fallback.webp", {
        "catalog-0001": "/images/recipes/catalog/catalog-0001.webp",
        "catalog-0002": "https://example.com/nope.webp"
      })
    ).toBe("/images/recipes/ai/fallback.webp");
  });

  it("prefers priority dish-specific assets for common fish searches", () => {
    const [walleye] = searchCatalogRecipes({ mainIngredient: "walleye", kosherForPassover: true }, 1, {
      seed: "photo-check",
      varyWithinTopMatches: true
    });
    const [salmon] = searchCatalogRecipes({ mainIngredient: "salmon" }, 1, {
      seed: "photo-check",
      varyWithinTopMatches: true
    });

    expect(findRecipeImageAssetByKey(walleye.catalog.imageKey)?.path).toMatch(/^\/images\/recipes\/ai\//);
    expect(findRecipeImageAssetByKey(salmon.catalog.imageKey)?.path).toMatch(/^\/images\/recipes\/ai\//);
  });

  it("prefers imported raster assets over SVG placeholders", () => {
    const baseAsset: RecipeImageAsset = {
      key: "walleye-placeholder",
      path: "/images/recipes/ai/walleye-placeholder.svg",
      sourceType: "generated",
      mainMatches: ["walleye"],
      familyMatches: ["fish"],
      baseMatches: ["quinoa"],
      flavorMatches: ["lemon"],
      passoverSafe: true,
      subject: "walleye",
      prompt: "walleye",
      attribution: null,
      sourceUrl: null,
      license: null
    };
    const ranked = rankRecipeImageAssets(
      {
        mainTitle: "Walleye Fillets",
        mainFamily: "fish",
        baseTitle: "Quinoa",
        flavorTitle: "Lemon Herb",
        kosherForPassover: true,
        index: 1
      },
      [
        baseAsset,
        {
          ...baseAsset,
          key: "walleye-raster",
          path: "/images/recipes/ai/walleye-raster.webp",
          targetRasterPath: "/images/recipes/ai/walleye-raster.webp"
        }
      ]
    );

    expect(ranked[0]?.key).toBe("walleye-raster");
  });

  it("includes and ranks strict kosher for Passover walleye recipes", () => {
    const passoverWalleyeRecipes = listCatalogRecipes().filter(
      (record) => record.catalog.kosherForPassover && record.recipe.title.toLowerCase().includes("walleye")
    );
    const matches = searchCatalogRecipes({ mainIngredient: "walleye", recipeName: "walleye", kosherForPassover: true }, 10);

    expect(passoverWalleyeRecipes.length).toBeGreaterThanOrEqual(20);
    expect(matches).toHaveLength(10);
    for (const match of matches) {
      expect(match.catalog.kosherForPassover).toBe(true);
      expect(match.recipe.title.toLowerCase()).toContain("walleye");
    }
  });

  it("filters strict kosher for Passover recipes away from chametz and kitniyot", () => {
    const matches = searchCatalogRecipes({ kosherForPassover: true }, 30);
    const forbidden = /\b(?:rice|corn|beans?|lentils?|chickpeas?|soy|tofu|sesame|tahini|mustard|buckwheat|caraway|cardamom|pasta|pita|couscous|bread)\b/i;

    expect(matches.length).toBeGreaterThan(0);
    for (const record of matches) {
      const text = [
        record.recipe.title,
        record.recipe.notes,
        ...record.recipe.ingredients.flatMap((ingredient) => [ingredient.name, ingredient.shoppingName ?? ""])
      ]
        .join(" ")
        .replace(/\bcauliflower rice\b/gi, "cauliflower crumble");

      expect(record.catalog.kosherForPassover).toBe(true);
      expect(text).not.toMatch(forbidden);
    }
  });

  it("searches and ranks by cuisine, main ingredient, servings, and ingredients on hand", () => {
    const [match] = searchCatalogRecipes(
      {
        cuisinePreference: "Sephardi",
        mainIngredient: "chickpeas",
        availableIngredients: "carrots, quinoa",
        servings: 2
      },
      1
    );

    expect(match.recipe.title.toLowerCase()).toContain("chickpeas");
    expect(`${match.recipe.title} ${match.catalog.cuisine}`.toLowerCase()).toContain("sephardi");
  });

  it("filters results by calories per serving and total time", () => {
    const calorieMatches = searchCatalogRecipes({ maxCaloriesPerServing: 400 }, 20);
    const timeMatches = searchCatalogRecipes({ maxTotalTimeMinutes: 30 }, 20);

    expect(calorieMatches.length).toBeGreaterThan(0);
    expect(timeMatches.length).toBeGreaterThan(0);

    for (const match of calorieMatches) {
      expect(match.recipe.estimatedCaloriesPerServing ?? 0, match.recipe.title).toBeLessThanOrEqual(400);
    }

    for (const match of timeMatches) {
      expect(match.recipe.prepTimeMinutes + match.recipe.cookTimeMinutes, match.recipe.title).toBeLessThanOrEqual(30);
    }
  });

  it("combines walleye, Passover, calorie, and time filters", () => {
    const matches = searchCatalogRecipes(
      {
        mainIngredient: "walleye",
        recipeName: "walleye",
        kosherForPassover: true,
        maxCaloriesPerServing: 400,
        maxTotalTimeMinutes: 45
      },
      5
    );

    expect(matches.length).toBeGreaterThan(0);
    for (const match of matches) {
      expect(match.recipe.title.toLowerCase()).toContain("walleye");
      expect(match.catalog.kosherForPassover).toBe(true);
      expect(match.recipe.estimatedCaloriesPerServing ?? 0).toBeLessThanOrEqual(400);
      expect(match.recipe.prepTimeMinutes + match.recipe.cookTimeMinutes).toBeLessThanOrEqual(45);
    }
  });

  it("orders exact cooking-device matches before fallback matches", () => {
    const airFryerMatches = searchCatalogRecipes({ cookingDevice: "air-fryer" }, 18);
    const sparseSlowCookerMatches = searchCatalogRecipes(
      {
        cookingDevice: "slow-cooker",
        mainIngredient: "walleye",
        kosherForPassover: true,
        maxCaloriesPerServing: 400,
        maxTotalTimeMinutes: 45
      },
      18
    );

    expect(airFryerMatches).toHaveLength(18);
    expect(airFryerMatches.every((match) => match.catalog.compatibleCookingDevices.includes("air-fryer"))).toBe(true);
    expect(sparseSlowCookerMatches).toHaveLength(18);
    expect(sparseSlowCookerMatches.some((match) => !match.catalog.compatibleCookingDevices.includes("slow-cooker"))).toBe(true);
  });

  it("combines cooking-device, Passover, calorie, and time filters", () => {
    const matches = searchCatalogRecipes(
      {
        cookingDevice: "instant-pot",
        kosherForPassover: true,
        maxCaloriesPerServing: 700,
        maxTotalTimeMinutes: 65
      },
      12
    );

    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((match) => match.catalog.compatibleCookingDevices.includes("instant-pot"))).toBe(true);
    for (const match of matches) {
      expect(match.catalog.kosherForPassover, match.recipe.title).toBe(true);
      expect(match.recipe.estimatedCaloriesPerServing ?? 0, match.recipe.title).toBeLessThanOrEqual(700);
      expect(match.recipe.prepTimeMinutes + match.recipe.cookTimeMinutes, match.recipe.title).toBeLessThanOrEqual(65);
    }
  });

  it("keeps generated catalog method coverage and instruction diversity balanced", () => {
    const records = listCatalogRecipes();

    for (const device of concreteCookingDevices) {
      const primaryMatches = records.filter((record) => record.catalog.primaryCookingDevice === device);
      const passoverPrimaryMatches = primaryMatches.filter((record) => record.catalog.kosherForPassover);
      const instructionPatterns = new Set(primaryMatches.map(methodPattern));

      expect(primaryMatches.length, `${device} total coverage`).toBeGreaterThanOrEqual(60);
      expect(passoverPrimaryMatches.length, `${device} Passover coverage`).toBeGreaterThanOrEqual(12);
      expect(instructionPatterns.size, `${device} instruction patterns`).toBeGreaterThanOrEqual(2);
    }
  });

  it("ranks recipe title search above generic matches", () => {
    const knownRecipe = listCatalogRecipes()[17];
    const [match] = searchCatalogRecipes({ recipeName: knownRecipe.recipe.title }, 1);
    const varied = findVariedCatalogRecipe({ recipeName: knownRecipe.recipe.title }, "different-seed");

    expect(match.recipe.title).toBe(knownRecipe.recipe.title);
    expect(varied.recipe.title).toBe(knownRecipe.recipe.title);
  });

  it("rotates normal searches inside strong matches", () => {
    const first = findVariedCatalogRecipe({ mainIngredient: "chicken", cuisinePreference: "Mediterranean" }, "seed-one");
    const second = findVariedCatalogRecipe({ mainIngredient: "chicken", cuisinePreference: "Mediterranean" }, "seed-two");

    expect(first.id).not.toBe(second.id);
  });

  it("finds catalog records by id", () => {
    const record = findBestCatalogRecipe({ mainIngredient: "mushrooms" });

    expect(record).toBeDefined();
    expect(findCatalogRecipeById(record.id)?.id).toBe(record.id);
  });
});
