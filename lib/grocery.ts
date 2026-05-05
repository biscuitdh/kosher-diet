import type { GroceryListItem, RecipeIngredient, RecipeRecord, SavedRecipe, ShoppingStore } from "@/lib/schemas";
import { groceryListItemSchema } from "@/lib/schemas";
import { getShoppingName, isKosherMeatSearch, shoppingLinksForIngredient, type ShoppingLink } from "@/lib/shopping";

export type GroceryAddResult = {
  added: number;
  updated: number;
};

export type GroceryStoreGroup = {
  store: ShoppingStore;
  label: string;
  items: Array<{
    item: GroceryListItem;
    primaryLink: ShoppingLink;
    alternateLinks: ShoppingLink[];
  }>;
};

export type WalmartCartSpec = {
  store: "walmart";
  cartSpecVersion: 1;
  profileId: string;
  items: Array<{
    name: string;
    shoppingName: string;
    cartQuantity: number;
    targetPackage: string;
    searchUrl: string;
    strictKosher?: true;
  }>;
};

export type WalmartOrderManifest = WalmartCartSpec;

type UnitInfo = {
  category: "volume" | "weight" | "count";
  factor: number;
  unit: string;
};

const UNIT_ALIASES: Record<string, UnitInfo> = {
  tsp: { category: "volume", factor: 1, unit: "tsp" },
  teaspoon: { category: "volume", factor: 1, unit: "tsp" },
  teaspoons: { category: "volume", factor: 1, unit: "tsp" },
  tbsp: { category: "volume", factor: 3, unit: "tbsp" },
  tablespoon: { category: "volume", factor: 3, unit: "tbsp" },
  tablespoons: { category: "volume", factor: 3, unit: "tbsp" },
  cup: { category: "volume", factor: 48, unit: "cups" },
  cups: { category: "volume", factor: 48, unit: "cups" },
  oz: { category: "weight", factor: 1, unit: "oz" },
  ounce: { category: "weight", factor: 1, unit: "oz" },
  ounces: { category: "weight", factor: 1, unit: "oz" },
  lb: { category: "weight", factor: 16, unit: "lb" },
  lbs: { category: "weight", factor: 16, unit: "lb" },
  pound: { category: "weight", factor: 16, unit: "lb" },
  pounds: { category: "weight", factor: 16, unit: "lb" },
  clove: { category: "count", factor: 1, unit: "cloves" },
  cloves: { category: "count", factor: 1, unit: "cloves" },
  bunch: { category: "count", factor: 1, unit: "bunches" },
  bunches: { category: "count", factor: 1, unit: "bunches" },
  round: { category: "count", factor: 1, unit: "rounds" },
  rounds: { category: "count", factor: 1, unit: "rounds" },
  fillet: { category: "count", factor: 1, unit: "fillets" },
  fillets: { category: "count", factor: 1, unit: "fillets" },
  piece: { category: "count", factor: 1, unit: "pieces" },
  pieces: { category: "count", factor: 1, unit: "pieces" },
  item: { category: "count", factor: 1, unit: "items" },
  items: { category: "count", factor: 1, unit: "items" }
};

const FRACTION_GLYPHS: Record<string, string> = {
  "¼": "1/4",
  "½": "1/2",
  "¾": "3/4",
  "⅓": "1/3",
  "⅔": "2/3",
  "⅛": "1/8",
  "⅜": "3/8",
  "⅝": "5/8",
  "⅞": "7/8"
};

type WalmartCartTarget = {
  patterns: string[];
  targetPackage: string;
  cartQuantity: number;
};

const WALMART_CART_TARGETS: WalmartCartTarget[] = [
  { patterns: ["garlic"], targetPackage: "1 fresh bulb or pack", cartQuantity: 1 },
  { patterns: ["fresh parsley", "parsley"], targetPackage: "1 bunch", cartQuantity: 1 },
  { patterns: ["lemons", "lemon"], targetPackage: "2 fresh lemons", cartQuantity: 2 },
  { patterns: ["yellow onions", "onions"], targetPackage: "1 bag or 2 medium onions", cartQuantity: 1 },
  { patterns: ["zucchini"], targetPackage: "2 whole zucchini", cartQuantity: 2 },
  { patterns: ["carrots"], targetPackage: "1 lb bag carrots", cartQuantity: 1 },
  { patterns: ["cauliflower rice"], targetPackage: "about 4 frozen or packaged bags", cartQuantity: 4 },
  { patterns: ["ground sumac", "sumac"], targetPackage: "1 spice jar", cartQuantity: 1 },
  { patterns: ["celery"], targetPackage: "1 bunch/stalk bag", cartQuantity: 1 },
  { patterns: ["fennel bulb", "fennel"], targetPackage: "1 fresh fennel bulb", cartQuantity: 1 },
  { patterns: ["basmati rice"], targetPackage: "1 ordinary bag", cartQuantity: 1 },
  { patterns: ["cod fillets", "cod"], targetPackage: "1 plain 12-16 oz pack", cartQuantity: 1 },
  { patterns: ["ground coriander", "coriander"], targetPackage: "1 spice jar", cartQuantity: 1 },
  { patterns: ["limes", "lime"], targetPackage: "2 fresh limes", cartQuantity: 2 },
  { patterns: ["fresh mint", "mint"], targetPackage: "1 bunch or clamshell", cartQuantity: 1 },
  { patterns: ["kale"], targetPackage: "1 bunch or bag", cartQuantity: 1 },
  { patterns: ["butternut squash", "squash"], targetPackage: "1 squash or pre-cut pack", cartQuantity: 1 },
  { patterns: ["atlantic salmon fillets", "salmon fillets", "salmon"], targetPackage: "1 plain 12-16 oz pack", cartQuantity: 1 },
  { patterns: ["fish fillets", "walleye", "halibut", "snapper", "seabass", "trout", "tuna", "fillets"], targetPackage: "1 plain 12-16 oz pack", cartQuantity: 1 }
];

const STRICT_KOSHER_MEAT_WORDS = new Set(["beef", "chicken", "duck", "lamb", "meat", "steak", "thigh", "thighs", "turkey"]);
const WALMART_BLOCKED_MEAT_WORDS = new Set(["beef", "brisket", "chicken", "duck", "lamb", "meat", "poultry", "roast", "steak", "thigh", "thighs", "turkey", "veal"]);
const WALMART_ALLOWED_FISH_WORDS = new Set(["cod", "fish", "halibut", "salmon", "seabass", "snapper", "trout", "tuna", "walleye"]);
const SPECIALTY_KOSHER_MEAT_STORES: ShoppingStore[] = ["kosh", "grow-and-behold", "kol-foods", "specialty-kosher"];

function stripKosherLabel(value: string) {
  return value.replace(/\s*\((?:meat|dairy|parve)\)\s*/gi, "").replace(/\s+/g, " ").trim();
}

export function normalizeGroceryKey(value: string) {
  return stripKosherLabel(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(fresh|large|medium|small|certified|kosher|for|passover)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedUnit(unit: string): UnitInfo {
  const key = unit.toLowerCase().replace(/\./g, "").trim();
  if (!key) return { category: "count", factor: 1, unit: "" };
  return UNIT_ALIASES[key] ?? { category: "count", factor: 1, unit: unit.trim() };
}

function parseFraction(value: string) {
  const match = value.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  if (!match) return undefined;
  const numerator = Number(match[1]);
  const denominator = Number(match[2]);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return undefined;
  return numerator / denominator;
}

export function parseGroceryQuantity(value: string) {
  const normalized = value
    .trim()
    .replace(/[¼½¾⅓⅔⅛⅜⅝⅞]/g, (glyph) => ` ${FRACTION_GLYPHS[glyph]} `)
    .replace(/\s+/g, " ");
  if (!normalized) return undefined;
  if (/[~+]|\b(to|or)\b|-/i.test(normalized)) return undefined;

  const parts = normalized.split(" ");
  let total = 0;
  for (const part of parts) {
    const fraction = parseFraction(part);
    if (fraction !== undefined) {
      total += fraction;
      continue;
    }
    const number = Number(part);
    if (!Number.isFinite(number)) return undefined;
    total += number;
  }

  return total > 0 ? total : undefined;
}

function formatNumber(value: number) {
  const rounded = Math.round(value * 100) / 100;
  const whole = Math.floor(rounded);
  const fraction = rounded - whole;
  const fractionText =
    Math.abs(fraction - 0.25) < 0.01
      ? "1/4"
      : Math.abs(fraction - 0.33) < 0.01
        ? "1/3"
        : Math.abs(fraction - 0.5) < 0.01
          ? "1/2"
          : Math.abs(fraction - 0.67) < 0.01
            ? "2/3"
            : Math.abs(fraction - 0.75) < 0.01
              ? "3/4"
              : "";

  if (fractionText && whole > 0) return `${whole} ${fractionText}`;
  if (fractionText) return fractionText;
  return String(rounded).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function preferredOutputUnit(category: UnitInfo["category"], baseValue: number, fallbackUnit: string) {
  if (category === "volume") {
    if (baseValue >= 24) return { unit: "cups", factor: 48 };
    if (baseValue >= 3) return { unit: "tbsp", factor: 3 };
    return { unit: "tsp", factor: 1 };
  }
  if (category === "weight") {
    if (baseValue >= 16) return { unit: "lb", factor: 16 };
    return { unit: "oz", factor: 1 };
  }
  return { unit: fallbackUnit, factor: 1 };
}

function mergeQuantities(existing: GroceryListItem, incoming: GroceryListItem) {
  const existingValue = parseGroceryQuantity(existing.quantity);
  const incomingValue = parseGroceryQuantity(incoming.quantity);
  const existingUnit = normalizedUnit(existing.unit);
  const incomingUnit = normalizedUnit(incoming.unit);

  if (
    existingValue === undefined ||
    incomingValue === undefined ||
    existingUnit.category !== incomingUnit.category ||
    (existingUnit.category === "count" && existingUnit.unit !== incomingUnit.unit)
  ) {
    return undefined;
  }

  const baseValue = existingValue * existingUnit.factor + incomingValue * incomingUnit.factor;
  const output = preferredOutputUnit(existingUnit.category, baseValue, existingUnit.unit || incomingUnit.unit);
  return {
    quantity: formatNumber(baseValue / output.factor),
    unit: output.unit
  };
}

function ingredientQuantityNote(item: GroceryListItem) {
  return [item.quantity, item.unit, item.displayName].filter(Boolean).join(" ");
}

function mergeSources(existing: GroceryListItem, incoming: GroceryListItem) {
  return [...existing.sourceRecipes, ...incoming.sourceRecipes].reduce<GroceryListItem["sourceRecipes"]>((sources, source) => {
    if (!sources.some((item) => item.recipeId === source.recipeId)) sources.push(source);
    return sources;
  }, []);
}

function mergePreferredStores(existing: GroceryListItem, incoming: GroceryListItem) {
  const stores = [...(existing.preferredStores ?? []), ...(incoming.preferredStores ?? [])].reduce<ShoppingStore[]>((accumulator, store) => {
    if (!accumulator.includes(store)) accumulator.push(store);
    return accumulator;
  }, []);
  return stores.length > 0 ? stores : undefined;
}

export function mergeGroceryItem(existing: GroceryListItem, incoming: GroceryListItem, now = new Date().toISOString()): GroceryListItem {
  const mergedQuantity = mergeQuantities(existing, incoming);
  const quantityNotes = mergedQuantity
    ? existing.quantityNotes
    : [...existing.quantityNotes, ingredientQuantityNote(incoming)].filter(Boolean);

  return groceryListItemSchema.parse({
    ...existing,
    quantity: mergedQuantity?.quantity ?? existing.quantity,
    unit: mergedQuantity?.unit ?? existing.unit,
    quantityNotes: Array.from(new Set(quantityNotes)).slice(0, 12),
    pantryStaple: existing.pantryStaple && incoming.pantryStaple,
    checked: false,
    preferredStores: mergePreferredStores(existing, incoming),
    shoppingUrlOverrides: { ...existing.shoppingUrlOverrides, ...incoming.shoppingUrlOverrides },
    sourceRecipes: mergeSources(existing, incoming),
    updatedAt: now
  });
}

export function groceryItemFromIngredient(
  ingredient: RecipeIngredient,
  record: RecipeRecord | SavedRecipe,
  profileId: string,
  now = new Date().toISOString()
): GroceryListItem {
  const shoppingName = getShoppingName(ingredient);
  const ingredientKey = normalizeGroceryKey(shoppingName || ingredient.name);

  return groceryListItemSchema.parse({
    id: `grocery-${profileId}-${ingredientKey}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    profileId,
    ingredientKey,
    displayName: stripKosherLabel(ingredient.name),
    shoppingName,
    quantity: ingredient.quantity,
    unit: ingredient.unit,
    quantityNotes: [],
    pantryStaple: Boolean(ingredient.pantryStaple),
    checked: false,
    preferredStores: ingredient.preferredStores,
    shoppingUrlOverrides: ingredient.shoppingUrlOverrides,
    sourceRecipes: [{ recipeId: record.id, title: record.recipe.title }],
    createdAt: now,
    updatedAt: now
  });
}

export function groceryItemFromCustomInput(
  input: { displayName: string; quantity?: string; unit?: string },
  profileId: string,
  now = new Date().toISOString()
): GroceryListItem {
  const displayName = input.displayName.trim();
  const ingredientKey = normalizeGroceryKey(displayName);

  return groceryListItemSchema.parse({
    id: `grocery-${profileId}-${ingredientKey}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    profileId,
    ingredientKey,
    displayName,
    shoppingName: displayName,
    quantity: input.quantity?.trim() ?? "",
    unit: input.unit?.trim() ?? "",
    quantityNotes: [],
    pantryStaple: false,
    checked: false,
    sourceRecipes: [],
    createdAt: now,
    updatedAt: now
  });
}

export function groceryItemToIngredient(item: GroceryListItem): RecipeIngredient {
  return {
    name: `${item.displayName} (parve)`,
    quantity: item.quantity || "1",
    unit: item.unit,
    shoppingName: item.shoppingName,
    pantryStaple: item.pantryStaple,
    preferredStores: item.preferredStores,
    shoppingUrlOverrides: item.shoppingUrlOverrides
  };
}

export function shoppingLinksForGroceryItem(item: GroceryListItem) {
  return shoppingLinksForIngredient(groceryItemToIngredient(item));
}

export function formatGroceryItem(item: GroceryListItem) {
  return [item.quantity, item.unit, item.displayName].filter(Boolean).join(" ");
}

export function sortGroceryItemsForDisplay(items: GroceryListItem[]) {
  return [...items].sort((left, right) => Number(left.checked) - Number(right.checked));
}

export function groupGroceryItemsByStore(items: GroceryListItem[]) {
  const groups = new Map<ShoppingStore, GroceryStoreGroup>();

  for (const item of items) {
    if (item.pantryStaple || item.checked) continue;
    const [primaryLink, ...alternateLinks] = shoppingLinksForGroceryItem(item);
    if (!primaryLink) continue;

    const group = groups.get(primaryLink.store) ?? {
      store: primaryLink.store,
      label: primaryLink.label,
      items: []
    };
    group.items.push({ item, primaryLink, alternateLinks });
    groups.set(primaryLink.store, group);
  }

  return Array.from(groups.values());
}

export function specialtyKosherMeatLinksForGroceryItem(item: GroceryListItem) {
  if (item.pantryStaple || item.checked || !isKosherMeatSearch(`${item.shoppingName} ${item.displayName}`)) return [];
  return shoppingLinksForIngredient({
    ...groceryItemToIngredient(item),
    preferredStores: SPECIALTY_KOSHER_MEAT_STORES
  }).filter((link) => SPECIALTY_KOSHER_MEAT_STORES.includes(link.store));
}

export function groupSpecialtyKosherMeatItemsByStore(items: GroceryListItem[]) {
  const groups = new Map<ShoppingStore, GroceryStoreGroup>();

  for (const item of items) {
    const [primaryLink, ...alternateLinks] = specialtyKosherMeatLinksForGroceryItem(item);
    if (!primaryLink) continue;

    const group = groups.get(primaryLink.store) ?? {
      store: primaryLink.store,
      label: primaryLink.label,
      items: []
    };
    group.items.push({ item, primaryLink, alternateLinks });
    groups.set(primaryLink.store, group);
  }

  return Array.from(groups.values());
}

export function walmartLinkForGroceryItem(item: GroceryListItem) {
  if (item.pantryStaple || item.checked) return undefined;
  return shoppingLinksForGroceryItem(item).find((link) => link.store === "walmart");
}

function isWalmartCartEligibleGroceryItem(item: GroceryListItem) {
  const words = new Set(`${item.shoppingName} ${item.displayName}`.toLowerCase().match(/[a-z]+/g) ?? []);
  const hasBlockedMeat = Array.from(WALMART_BLOCKED_MEAT_WORDS).some((word) => words.has(word));
  const hasAllowedFish = Array.from(WALMART_ALLOWED_FISH_WORDS).some((word) => words.has(word));
  return !hasBlockedMeat || hasAllowedFish;
}

export function walmartOrderItems(items: GroceryListItem[]) {
  return items.flatMap((item) => {
    if (!isWalmartCartEligibleGroceryItem(item)) return [];
    const walmartLink = walmartLinkForGroceryItem(item);
    return walmartLink ? [{ item, walmartLink }] : [];
  });
}

function isStrictKosherMeatItem(item: GroceryListItem) {
  const words = new Set(`${item.shoppingName} ${item.displayName}`.toLowerCase().match(/[a-z]+/g) ?? []);
  return words.has("kosher") && Array.from(STRICT_KOSHER_MEAT_WORDS).some((word) => words.has(word));
}

function walmartCartTargetForGroceryItem(item: GroceryListItem) {
  const haystack = normalizeGroceryKey(`${item.shoppingName} ${item.displayName}`);
  const target = WALMART_CART_TARGETS.find((candidate) => candidate.patterns.some((pattern) => haystack.includes(pattern)));
  return {
    targetPackage: target?.targetPackage ?? "1 practical Walmart grocery package",
    cartQuantity: target?.cartQuantity ?? 1,
    strictKosher: isStrictKosherMeatItem(item)
  };
}

export function buildWalmartOrderManifest(items: GroceryListItem[], profileId: string): WalmartOrderManifest {
  return {
    store: "walmart",
    cartSpecVersion: 1,
    profileId,
    items: walmartOrderItems(items).map(({ item, walmartLink }) => {
      const target = walmartCartTargetForGroceryItem(item);
      const specItem: WalmartCartSpec["items"][number] = {
        name: item.displayName,
        shoppingName: item.shoppingName,
        cartQuantity: target.cartQuantity,
        targetPackage: target.targetPackage,
        searchUrl: walmartLink.href
      };
      if (target.strictKosher) specItem.strictKosher = true;
      return specItem;
    })
  };
}

export function buildWalmartCartAgentPrompt(items: GroceryListItem[], profileId: string) {
  return [
    "Use $walmart-grocery-cart to add this KosherTable Walmart cart spec to my Walmart cart.",
    "Use a fresh Walmart-only Chrome window in my current profile.",
    "Preserve existing cart contents and do not checkout.",
    "Prefer Walmart items I have bought before when Walmart shows that option and the item is still a practical match.",
    "",
    JSON.stringify(buildWalmartOrderManifest(items, profileId), null, 2)
  ].join("\n");
}

export function buildGroceryAgentManifest(items: GroceryListItem[], profileId: string) {
  return {
    profileId,
    generatedAt: new Date().toISOString(),
    stores: groupGroceryItemsByStore(items).map((group) => ({
      store: group.store,
      label: group.label,
      items: group.items.map(({ item, primaryLink, alternateLinks }) => ({
        id: item.id,
        name: item.displayName,
        shoppingName: item.shoppingName,
        quantity: item.quantity,
        unit: item.unit,
        sourceRecipes: item.sourceRecipes,
        searchUrl: primaryLink.href,
        alternateStores: alternateLinks.map((link) => ({ store: link.store, label: link.label, href: link.href }))
      }))
    }))
  };
}
