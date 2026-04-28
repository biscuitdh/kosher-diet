import { expect, test, type Locator, type Page } from "@playwright/test";

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

function visibleNavLink(page: Page, href: string, label: RegExp) {
  return page.locator(`a[href="${href}"]:visible`).filter({ hasText: label }).first();
}

async function expectFourByThreeFrame(frame: Locator) {
  await expect(frame).toBeVisible();
  const box = await frame.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.width).toBeGreaterThan(80);
  expect(Math.abs((box?.height ?? 0) - (box?.width ?? 0) * 0.75)).toBeLessThanOrEqual(3);
}

test("home renders the Find form", async ({ page }) => {
  await page.goto("/");
  await expectHeaderSearch(page);
  const themeToggleBox = await page.getByRole("button", { name: /^Toggle theme$/ }).boundingBox();
  const brandBox = await page.getByRole("link", { name: /KosherTable home/i }).boundingBox();
  expect(themeToggleBox).not.toBeNull();
  expect(brandBox).not.toBeNull();
  expect(themeToggleBox?.x ?? 0).toBeLessThan(brandBox?.x ?? 0);
  await expect(page.locator('a[href="/"]').filter({ hasText: /^Find$/ }).first()).toBeAttached();
  await expect(page.locator('a[href="/find"]').filter({ hasText: /^Browse$/ }).first()).toBeAttached();
  await expect(page.locator('a[href="/favorites"]').filter({ hasText: /^Favorites$/ }).first()).toBeAttached();
  await expect(page.locator("nav").filter({ hasText: /^Home$/ })).toHaveCount(0);
  await expect(page.getByText("Be specific when you care.")).toHaveCount(0);
  await expect(page.getByRole("switch", { name: /Kosher for Passover/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Find Recipe/i })).toBeVisible();
  await expect(page.getByText("Nightshade & Tomato Safe")).toHaveCount(0);
  await expect(page.getByText("Set the profile once")).toHaveCount(0);
});

test("top-level navigation opens Find, Browse, and Favorites", async ({ page }) => {
  await page.goto("/find");

  await visibleNavLink(page, "/", /^Find$/).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: /Find Recipe/i })).toBeVisible();

  await visibleNavLink(page, "/find", /^Browse$/).click();
  await expect(page).toHaveURL(/\/find$/);
  await expect(page.getByRole("button", { name: /Shuffle/i })).toBeVisible();

  await visibleNavLink(page, "/favorites", /^Favorites$/).click();
  await expect(page).toHaveURL(/\/favorites$/);
  await expect(page.getByRole("heading", { level: 1, name: /^Favorites$/ })).toBeVisible();
});

test("header search is visible on browse page", async ({ page }) => {
  await page.goto("/find");
  await expectHeaderSearch(page);
});

test("header search is visible on recipe pages", async ({ page }) => {
  await page.goto("/recipes/catalog-0001");
  await expectHeaderSearch(page);
  await expectFourByThreeFrame(page.getByTestId("recipe-detail-image-frame"));
});

test("header search opens browse results", async ({ page }) => {
  await page.goto("/recipes/catalog-0001");
  await expectHeaderSearch(page);
  await page.getByRole("textbox", { name: /Search recipes/i }).fill("walleye");
  await page.getByRole("button", { name: /^Search recipes$/ }).click();

  await expect(page).toHaveURL(/\/find\?recipeName=walleye$/);
  await expect(page.getByRole("button", { name: /Shuffle/i })).toBeVisible();
  await expect(page.getByTestId("recipe-match-card").first()).toContainText(/walleye/i);
});

test("onboarding redirects to find", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/generate$/);
  await expect(page.getByRole("button", { name: /Find Recipe/i })).toBeVisible();
});

test("find renders form controls without inner flow tabs", async ({ page }) => {
  await page.goto("/generate");
  await expectHeaderSearch(page);
  await expect(page.getByRole("heading", { level: 1, name: /^Find$/ })).toBeAttached();
  await expect(page.getByText("Be specific when you care.")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: /Recipe flow/i })).toHaveCount(0);
  await expect(page.getByLabel(/Search by recipe name/i)).toHaveCount(0);
  await expect(page.getByRole("switch", { name: /Kosher for Passover/i })).toBeVisible();
  await expect(page.getByText("No chametz or kitniyot.")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Crock pot", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: /^Occasion$/ })).toBeVisible();
  await expect(page.getByRole("combobox", { name: /^Cuisine preference$/ })).toBeVisible();
  await expect(page.locator("input#occasion")).toHaveCount(0);
  await expect(page.locator("input#cuisinePreference")).toHaveCount(0);
  await expect(page.getByLabel("Occasion suggestions")).toHaveCount(0);
  await expect(page.getByLabel("Cuisine suggestions")).toHaveCount(0);
  await expect(page.getByLabel(/Exclude ingredients/i)).toHaveCount(0);
  await expect(page.getByLabel(/Extra notes/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Surprise Me/i })).toBeVisible();
  await expect(page.getByText("Free testing mode")).toHaveCount(0);
});

test("find dropdowns submit standard occasion and cuisine values", async ({ page }) => {
  await page.goto("/generate");

  await page.getByRole("combobox", { name: /^Occasion$/ }).click();
  await page.getByRole("option", { name: "Shabbat dinner" }).click();
  await page.getByRole("combobox", { name: /^Cuisine preference$/ }).click();
  await page.getByRole("option", { name: "Sephardi" }).click();
  await page.getByLabel(/Main protein or veggie/i).fill("eggs");
  await page.getByRole("button", { name: /Find Recipe/i }).click();

  await expect(page).toHaveURL(/\/find\?/);
  await expect(page).toHaveURL(/occasion=Shabbat\+dinner/);
  await expect(page).toHaveURL(/cuisinePreference=Sephardi/);
  await expect(page).toHaveURL(/mainIngredient=eggs/);
});

test("find custom dropdown values persist through submit, recents, and draft", async ({ page }) => {
  await page.goto("/generate");

  await page.getByRole("combobox", { name: /^Occasion$/ }).click();
  await page.getByRole("option", { name: "Custom" }).click();
  await page.getByLabel("Custom occasion").fill("Sunday brunch");
  await page.getByRole("combobox", { name: /^Cuisine preference$/ }).click();
  await page.getByRole("option", { name: "Custom" }).click();
  await page.getByLabel("Custom cuisine preference").fill("Persian dairy");
  await page.getByLabel(/Main protein or veggie/i).fill("mushrooms");
  await page.getByRole("button", { name: /Find Recipe/i }).click();

  await expect(page).toHaveURL(/\/find\?/);
  await expect(page).toHaveURL(/occasion=Sunday\+brunch/);
  await expect(page).toHaveURL(/cuisinePreference=Persian\+dairy/);
  await page.waitForFunction(() => window.localStorage.getItem("koshertable.recentSearches.v1")?.includes("Persian dairy"));

  await page.goto("/find");
  const recentCustomSearch = page.getByTestId("recent-search").filter({ hasText: /Persian dairy/i }).first();
  await expect(recentCustomSearch).toBeVisible();
  await recentCustomSearch.click();
  await expect(page).toHaveURL(/occasion=Sunday\+brunch/);
  await expect(page).toHaveURL(/cuisinePreference=Persian\+dairy/);

  await page.goto("/generate");
  await expect(page.getByLabel("Custom occasion")).toHaveValue("Sunday brunch");
  await expect(page.getByLabel("Custom cuisine preference")).toHaveValue("Persian dairy");
});

test("find applies Passover suggestions and opens browse with device state", async ({ page }) => {
  await page.goto("/generate");

  const ingredientSuggestions = page.getByLabel("Ingredients on hand suggestions");
  await expect(page.getByLabel("Suggested sides suggestions")).toHaveCount(0);
  await expect(ingredientSuggestions.getByRole("button", { name: "Rice", exact: true })).toBeVisible();
  await page.getByRole("switch", { name: /Kosher for Passover/i }).click();
  await expect(ingredientSuggestions.getByRole("button", { name: "Rice", exact: true })).toHaveCount(0);
  await expect(ingredientSuggestions.getByRole("button", { name: "Matzo farfel" })).toBeVisible();

  await page.getByRole("button", { name: "Crock pot", exact: true }).click();
  await expect(page.getByRole("button", { name: "Crock pot", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel(/Main protein or veggie/i).fill("walleye");
  const sideSuggestions = page.getByLabel("Suggested sides suggestions");
  await expect(sideSuggestions.getByRole("button", { name: "Cauliflower rice", exact: true })).toBeVisible();
  await expect(sideSuggestions.getByRole("button", { name: "Rice", exact: true })).toHaveCount(0);
  await sideSuggestions.getByRole("button", { name: "Cauliflower rice", exact: true }).click();
  await expect(page.locator("#availableIngredients")).toHaveValue(/cauliflower rice/i);
  await page.getByRole("button", { name: /Find Recipe/i }).click();

  await expect(page).toHaveURL(/\/find\?/);
  await expect(page.getByRole("button", { name: /Shuffle/i })).toBeVisible();
  await expect(page.getByRole("navigation", { name: /Recipe flow/i })).toHaveCount(0);
  await expect(page.getByTestId("recipe-match-card")).toHaveCount(18);
  await expectFourByThreeFrame(page.getByTestId("recipe-match-image-frame").first());
  await page.waitForFunction(() => window.localStorage.getItem("koshertable.finderDraft.v1")?.includes("slow-cooker"));
});

test("browse filters by Kosher for Passover, calories, and time", async ({ page }) => {
  await page.goto("/find?mainIngredient=walleye&kosherForPassover=true&maxCaloriesPerServing=400&maxTotalTimeMinutes=45");

  await expectHeaderSearch(page);
  await expect(page.getByRole("heading", { level: 1, name: /^Browse$/ })).toBeAttached();
  await expect(page.getByText("Search nightshade-free, tomato-free kosher meals")).toHaveCount(0);
  await expect(page.getByText("clickable matches from the local catalog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Shuffle/i })).toBeVisible();
  await expect(page.getByRole("navigation", { name: /Recipe flow/i })).toHaveCount(0);
  await expect(page.getByRole("switch", { name: /Browse kosher for Passover/i })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("button", { name: "Air fryer", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "≤400" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "≤45 min" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("recipe-match-card")).toHaveCount(18);
  await expectFourByThreeFrame(page.getByTestId("recipe-match-image-frame").first());
  for (const card of await page.getByTestId("recipe-match-card").all()) {
    await expect(card).toContainText("Passover");
  }

  await page.getByRole("button", { name: /Shuffle/i }).click();
  await expect(page.getByTestId("recipe-match-card")).toHaveCount(18);
});

test("browse filters by cooking device and persists the filter", async ({ page }) => {
  await page.goto("/find");

  await page.getByRole("button", { name: "Air fryer", exact: true }).click();
  await expect(page.getByRole("button", { name: "Air fryer", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/cookingDevice=air-fryer/);
  await page.waitForFunction(() => window.localStorage.getItem("koshertable.finderDraft.v1")?.includes("air-fryer"));
  await page.waitForFunction(() => window.localStorage.getItem("koshertable.recentSearches.v1")?.includes("air-fryer"));

  await expect(page.getByTestId("recipe-match-card")).toHaveCount(18);
  for (const card of await page.getByTestId("recipe-match-card").all()) {
    await expect(card).toContainText("Air fryer");
  }
});

test("browse uses device fallbacks after exact matches", async ({ page }) => {
  await page.goto("/find?cookingDevice=instant-pot&kosherForPassover=true&maxCaloriesPerServing=700&maxTotalTimeMinutes=65");

  const cards = page.getByTestId("recipe-match-card");
  await expect(cards).toHaveCount(18);
  await expect(page.getByRole("button", { name: "Instant Pot", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("switch", { name: /Browse kosher for Passover/i })).toHaveAttribute("aria-checked", "true");

  const cardList = await cards.all();
  for (const card of cardList.slice(0, 12)) {
    await expect(card).toContainText("Instant Pot");
  }
  const fallbackTexts = await Promise.all(cardList.slice(12).map((card) => card.textContent()));
  expect(fallbackTexts.some((text) => !text?.includes("Instant Pot"))).toBe(true);
});

test("browse Passover filter can be toggled directly", async ({ page }) => {
  await page.goto("/find");

  const passoverSwitch = page.getByRole("switch", { name: /Browse kosher for Passover/i });
  await expect(passoverSwitch).toBeVisible();
  await passoverSwitch.click();
  await expect(passoverSwitch).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("recipe-match-card")).toHaveCount(18);
  for (const card of await page.getByTestId("recipe-match-card").all()) {
    await expect(card).toContainText("Passover");
  }
});

test("browse restores recent searches", async ({ page }) => {
  await page.goto("/find?mainIngredient=walleye&kosherForPassover=true&maxCaloriesPerServing=400&maxTotalTimeMinutes=45");

  await expect(page.getByTestId("recipe-match-card")).toHaveCount(18);
  await page.waitForFunction(() => window.localStorage.getItem("koshertable.recentSearches.v1")?.includes("walleye"));
  await page.goto("/find");

  const recentWalleyeSearch = page
    .getByTestId("recent-search")
    .filter({ hasText: /walleye/i })
    .filter({ hasText: /Passover/i })
    .first();
  await expect(recentWalleyeSearch).toBeVisible();
  await recentWalleyeSearch.click();
  await expect(page).toHaveURL(/mainIngredient=walleye/);
  await expect(page.getByRole("switch", { name: /Browse kosher for Passover/i })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("button", { name: "≤400" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "≤45 min" })).toHaveAttribute("aria-pressed", "true");
});

test("recipe favorites are scoped by selected profile", async ({ page }) => {
  await page.goto("/recipes/catalog-0001");

  await expect(page.getByRole("button", { name: /^Favorite$/ })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: /^Favorite$/ }).click();
  await expect(page.getByRole("button", { name: /^Favorited$/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /^Favorited$/ }).locator("svg").first()).toHaveAttribute("fill", "currentColor");

  await page.getByLabel(/New recipe profile name/i).fill("Sam");
  await page.getByRole("button", { name: /^Add$/ }).click();
  await expect(page.getByRole("button", { name: /^Favorite$/ })).toBeVisible();

  await page.getByRole("button", { name: /^Favorite$/ }).click();
  await expect(page.getByRole("button", { name: /^Favorited$/ })).toBeVisible();

  await page.getByRole("combobox", { name: /Recipe profile/i }).click();
  await page.getByRole("option", { name: "Household" }).click();
  await expect(page.getByRole("button", { name: /^Favorited$/ })).toBeVisible();
});

test("favorites page lists saved recipes by active profile", async ({ page }) => {
  await page.goto("/favorites");
  await expectHeaderSearch(page);
  await expect(page.getByRole("heading", { level: 1, name: /^Favorites$/ })).toBeVisible();
  await expect(page.getByText("No favorites yet")).toBeVisible();
  await expect(page.getByRole("link", { name: /Browse recipes/i })).toHaveAttribute("href", "/find");

  await page.goto("/recipes/catalog-0001");
  await page.getByRole("button", { name: /^Favorite$/ }).click();
  await expect(page.getByRole("button", { name: /^Favorited$/ })).toHaveAttribute("aria-pressed", "true");

  await page.goto("/favorites");
  await expect(page.locator('a[href="/recipes/catalog-0001"]')).toBeVisible();
  await expectFourByThreeFrame(page.getByTestId("recipe-card-image-frame").first());
  await expect(page.getByText("No favorites yet")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Unfavorite$/ })).toBeVisible();
  await page.getByRole("button", { name: /^Unfavorite$/ }).click();
  await expect(page).toHaveURL(/\/favorites$/);
  await expect(page.locator('a[href="/recipes/catalog-0001"]')).toHaveCount(0);
  await expect(page.getByText("No favorites yet")).toBeVisible();

  await page.goto("/recipes/catalog-0001");
  await page.getByRole("button", { name: /^Favorite$/ }).click();
  await page.goto("/favorites");
  await page.getByLabel(/New recipe profile name/i).fill("Sam");
  await page.getByRole("button", { name: /^Add$/ }).click();
  await expect(page.getByText("No favorites yet")).toBeVisible();
  await expect(page.locator('a[href="/recipes/catalog-0001"]')).toHaveCount(0);

  await page.getByRole("combobox", { name: /Recipe profile/i }).click();
  await page.getByRole("option", { name: "Household" }).click();
  await expect(page.locator('a[href="/recipes/catalog-0001"]')).toBeVisible();
});
