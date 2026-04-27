import type { RecipeIngredient, ShoppingStore } from "@/lib/schemas";

export type ShoppingLink = {
  store: ShoppingStore;
  label: string;
  href: string;
};

const STORE_LABELS: Record<ShoppingStore, string> = {
  walmart: "Walmart",
  wegmans: "Wegmans",
  kosh: "KŌSH",
  "grow-and-behold": "Grow & Behold",
  "kol-foods": "KOL Foods",
  "specialty-kosher": "Specialty kosher"
};

function stripKosherLabel(value: string) {
  return value.replace(/\s*\((?:meat|dairy|parve)\)\s*/gi, "").replace(/\s+/g, " ").trim();
}

export function getShoppingName(ingredient: RecipeIngredient) {
  return stripKosherLabel(ingredient.shoppingName || ingredient.name);
}

export function formatIngredientForCopy(ingredient: RecipeIngredient) {
  const quantity = [ingredient.quantity, ingredient.unit].filter(Boolean).join(" ").trim();
  const name = getShoppingName(ingredient);
  return quantity ? `${quantity} ${name}` : name;
}

export function isKosherMeatSearch(name: string) {
  return /\b(?:kosher\s+)?(?:beef|chicken|poultry|turkey|lamb|veal|duck|brisket|steak|roast|ground beef|stew meat)\b/i.test(name);
}

export function isKosherFishSearch(name: string) {
  return /\b(?:fish|fillets?|salmon|cod|trout|tuna|walleye|halibut|snapper|seabass)\b/i.test(name);
}

function koshUrlFor(name: string) {
  if (/\bpassover\b/i.test(name)) return "https://www.kosh.com/kosher-for-passover.html";
  if (/\bchicken\s+(?:breast|cutlets?|filets?)\b/i.test(name)) return "https://www.kosh.com/chicken-breast-filets.html";
  if (/\bchicken\s+(?:thigh|thighs|leg|legs|drumstick|drumsticks|dark)\b/i.test(name)) return "https://www.kosh.com/poultry/kosher-chicken/dark-meat-chicken.html";
  if (/\b(?:chicken|poultry|turkey)\b/i.test(name)) return "https://www.kosh.com/kosher-chicken.html";
  if (/\bground beef\b/i.test(name)) return "https://www.kosh.com/kosh-ground-beef-blend-pc-lb-13132.html";
  if (/\b(?:beef\s+)?stew meat\b/i.test(name)) return "https://www.kosh.com/kosh-stew-meat-11512.html";
  if (/\b(?:beef|brisket|steak|ground beef|roast|stew meat)\b/i.test(name)) return "https://www.kosh.com/kosher-beef.html";
  if (isKosherFishSearch(name)) return "https://www.kosh.com/kosher-fish.html";
  if (/\b(?:lamb|veal|duck|meat)\b/i.test(name)) return "https://www.kosh.com/meat.html";
  return "https://www.kosh.com/all-products";
}

function growAndBeholdUrlFor(name: string) {
  const encoded = encodeURIComponent(name);
  if (/\bground beef\b/i.test(name)) return "https://www.growandbehold.com/ground-beef/";
  if (/\bchicken\b/i.test(name)) return "https://www.growandbehold.com/poultry/chicken";
  if (/\bground lamb\b/i.test(name)) return "https://www.growandbehold.com/ground-lamb//";
  if (/\blamb\b/i.test(name)) return "https://www.growandbehold.com/lamb/";
  if (/\bbeef\b/i.test(name)) return "https://www.growandbehold.com/beef/";
  return `https://www.growandbehold.com/search.php?search_query=${encoded}`;
}

function kolFoodsUrlFor(name: string) {
  const encoded = encodeURIComponent(name);
  if (/\bbeef\b/i.test(name)) return "https://kolfoods.com/beef/";
  if (/\blamb\b/i.test(name)) return "https://kolfoods.com/lamb/";
  if (/\bchicken\b/i.test(name)) return "https://kolfoods.com/chicken/";
  if (/\bduck\b/i.test(name)) return "https://kolfoods.com/duck/";
  if (/\bsalmon\b/i.test(name)) return "https://kolfoods.com/salmon/";
  return `https://kolfoods.com/search.php?search_query=${encoded}`;
}

export function shoppingUrl(store: ShoppingStore, ingredient: RecipeIngredient) {
  const name = getShoppingName(ingredient);
  const encoded = encodeURIComponent(name);
  const override = ingredient.shoppingUrlOverrides?.[store];
  if (override) return override;

  switch (store) {
    case "walmart":
      return `https://www.walmart.com/search?q=${encoded}`;
    case "wegmans":
      return `https://www.wegmans.com/shop/search?query=${encoded}`;
    case "kosh":
      return koshUrlFor(name);
    case "grow-and-behold":
      return growAndBeholdUrlFor(name);
    case "kol-foods":
      return kolFoodsUrlFor(name);
    case "specialty-kosher":
      return isKosherMeatSearch(name) || isKosherFishSearch(name) ? koshUrlFor(name) : "https://www.kosh.com/all-products";
  }
}

export function shoppingLinksForIngredient(ingredient: RecipeIngredient): ShoppingLink[] {
  if (ingredient.pantryStaple) return [];

  const name = getShoppingName(ingredient);
  const preferredStores =
    ingredient.preferredStores && ingredient.preferredStores.length > 0
      ? ingredient.preferredStores
      : isKosherMeatSearch(name)
        ? (["kosh", "grow-and-behold", "kol-foods", "walmart", "wegmans"] as ShoppingStore[])
        : isKosherFishSearch(name)
          ? (["walmart", "wegmans", "kosh"] as ShoppingStore[])
          : (["walmart", "wegmans"] as ShoppingStore[]);

  return preferredStores.map((store) => ({
    store,
    label: STORE_LABELS[store],
    href: shoppingUrl(store, ingredient)
  }));
}
