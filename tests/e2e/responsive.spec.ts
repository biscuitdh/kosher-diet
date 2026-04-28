import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (window.name.includes("koshertable-storage-cleared")) return;
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.name = `${window.name} koshertable-storage-cleared`;
  });
});

async function expectHeaderSearch(page: Page) {
  await expect(page.getByRole("textbox", { name: /Search recipes/i })).toBeVisible();
}

test("dashboard renders primary CTA", async ({ page }) => {
  await page.goto("/");
  await expectHeaderSearch(page);
  await expect(page.getByRole("link", { name: /Find Meal Ideas/i }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Find Meal Ideas/i }).first()).toHaveAttribute("href", "/find");
  await expect(page.getByText("Nightshade & Tomato Safe")).toHaveCount(0);
  await expect(page.getByText("Set the profile once")).toHaveCount(0);
});

test("header search is visible on find page", async ({ page }) => {
  await page.goto("/find");
  await expectHeaderSearch(page);
});

test("header search is visible on recipe pages", async ({ page }) => {
  await page.goto("/recipes/catalog-0001");
  await expectHeaderSearch(page);
});

test("header search opens recipe matches", async ({ page }) => {
  await page.goto("/recipes/catalog-0001");
  await expectHeaderSearch(page);
  await page.getByRole("textbox", { name: /Search recipes/i }).fill("walleye");
  await page.getByRole("button", { name: /^Search recipes$/ }).click();

  await expect(page).toHaveURL(/\/find\?recipeName=walleye$/);
  await expect(page.getByRole("heading", { name: /^Recipe matches$/ })).toBeVisible();
  await expect(page.getByTestId("recipe-match-card").first()).toContainText(/walleye/i);
});

test("onboarding redirects to recipe brief", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/generate$/);
  await expect(page.getByRole("heading", { name: /^Recipe brief$/ }).first()).toBeVisible();
});

test("generator renders brief-only controls", async ({ page }) => {
  await page.goto("/generate");
  await expectHeaderSearch(page);
  await expect(page.getByRole("heading", { name: /^Recipe brief$/ }).first()).toBeVisible();
  await expect(page.getByLabel(/Search by recipe name/i)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /^Recipe matches$/ })).toHaveCount(0);
  await expect(page.getByRole("switch", { name: /Kosher for Passover/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Crock pot", exact: true })).toBeVisible();
  await expect(page.getByLabel(/Exclude ingredients/i)).toHaveCount(0);
  await expect(page.getByLabel(/Extra notes/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Surprise Me/i })).toBeVisible();
  await expect(page.getByText("Free testing mode")).toHaveCount(0);
});

test("brief applies Passover suggestions and opens find with device state", async ({ page }) => {
  await page.goto("/generate");

  const ingredientSuggestions = page.getByLabel("Ingredients on hand suggestions");
  await expect(ingredientSuggestions.getByRole("button", { name: "Rice", exact: true })).toBeVisible();
  await page.getByRole("switch", { name: /Kosher for Passover/i }).click();
  await expect(ingredientSuggestions.getByRole("button", { name: "Rice", exact: true })).toHaveCount(0);
  await expect(ingredientSuggestions.getByRole("button", { name: "Matzo farfel" })).toBeVisible();

  await page.getByRole("button", { name: "Crock pot", exact: true }).click();
  await expect(page.getByRole("button", { name: "Crock pot", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel(/Main protein or veggie/i).fill("walleye");
  await page.getByRole("button", { name: /Find Recipe/i }).click();

  await expect(page).toHaveURL(/\/find\?/);
  await expect(page.getByRole("heading", { name: /^Recipe matches$/ })).toBeVisible();
  await expect(page.getByTestId("recipe-match-card")).toHaveCount(18);
  await page.waitForFunction(() => window.localStorage.getItem("koshertable.finderDraft.v1")?.includes("slow-cooker"));

  await page.getByRole("link", { name: /Recipe Brief/i }).click();
  await expect(page).toHaveURL(/\/generate\?/);
  await expect(page.getByRole("button", { name: "Crock pot", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("find page filters, shuffles, and restores recent searches", async ({ page }) => {
  await page.goto("/find?mainIngredient=walleye&kosherForPassover=true&maxCaloriesPerServing=400&maxTotalTimeMinutes=45");

  await expectHeaderSearch(page);
  await expect(page.getByRole("heading", { name: /^Recipe matches$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "≤400" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "≤45 min" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("recipe-match-card")).toHaveCount(18);

  await page.getByRole("button", { name: /Shuffle/i }).click();
  await expect(page.getByTestId("recipe-match-card")).toHaveCount(18);

  await page.getByTestId("recipe-match-card").first().click();
  await page.waitForURL(/\/recipes\/catalog-/, { timeout: 10000 });
  await page.goto("/find");

  const recentWalleyeSearch = page.getByRole("button", { name: /walleye.*Passover.*<=400 cal.*<=45 min/i });
  await expect(recentWalleyeSearch).toBeVisible();
  await recentWalleyeSearch.click();
  await expect(page).toHaveURL(/mainIngredient=walleye/);
  await expect(page.getByRole("button", { name: "≤400" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "≤45 min" })).toHaveAttribute("aria-pressed", "true");
});

test("recipe favorites are scoped by selected profile", async ({ page }) => {
  await page.goto("/recipes/catalog-0001");

  await page.getByRole("button", { name: /^Favorite$/ }).click();
  await expect(page.getByRole("button", { name: /^Favorited$/ })).toBeVisible();

  await page.getByLabel(/New recipe profile name/i).fill("Sam");
  await page.getByRole("button", { name: /^Add$/ }).click();
  await expect(page.getByRole("button", { name: /^Favorite$/ })).toBeVisible();

  await page.getByRole("button", { name: /^Favorite$/ }).click();
  await expect(page.getByRole("button", { name: /^Favorited$/ })).toBeVisible();

  await page.getByRole("combobox", { name: /Recipe profile/i }).click();
  await page.getByRole("option", { name: "Household" }).click();
  await expect(page.getByRole("button", { name: /^Favorited$/ })).toBeVisible();
});
