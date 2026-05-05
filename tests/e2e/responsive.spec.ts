import { expect, test, type Locator, type Page } from "@playwright/test";

const TEST_AUTH_EMAIL = "test@example.com";
const ACCOUNT_BUTTON_NAME = new RegExp(`KosherTable account: ${TEST_AUTH_EMAIL}`, "i");
const FIREBASE_SESSION_KEY = "koshertable.firebaseSession.v1";

test.beforeEach(async ({ page }, testInfo) => {
  const storageToken = `koshertable-storage-cleared-${testInfo.workerIndex}-${Date.now()}-${Math.random()}`;
  await page.route("https://firestore.googleapis.com/v1/projects/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const jsonHeaders = { "Content-Type": "application/json" };

    if (request.method() === "GET" && url.pathname.includes("/documents/allowed_users/")) {
      await route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify({
          fields: {
            email: { stringValue: TEST_AUTH_EMAIL }
          }
        })
      });
      return;
    }

    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify({ documents: [] })
      });
      return;
    }

    await route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: "{}"
    });
  });
  await page.addInitScript(({ token, sessionKey, email }) => {
    if (!window.sessionStorage.getItem(token)) {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.sessionStorage.setItem(token, "true");
    }
    window.localStorage.setItem(
      sessionKey,
      JSON.stringify({
        idToken: "test-id-token",
        refreshToken: "test-refresh-token",
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        user: {
          id: "test-firebase-user",
          email
        }
      })
    );
  }, { token: storageToken, sessionKey: FIREBASE_SESSION_KEY, email: TEST_AUTH_EMAIL });
});

async function expectHeaderSearch(page: Page) {
  await expect(page.getByRole("textbox", { name: /Search recipes/i })).toBeVisible();
}

async function expectAuthenticated(page: Page) {
  await expect(page.getByRole("button", { name: ACCOUNT_BUTTON_NAME })).toBeVisible();
}

async function gotoPage(page: Page, url: string) {
  try {
    await page.goto(url);
  } catch (error) {
    if (!/interrupted by another navigation/i.test(String(error))) throw error;
    await page.waitForLoadState("domcontentloaded").catch(() => {});
    await page.goto(url);
  }
  await expectAuthenticated(page);
}

function visibleNavLink(page: Page, href: string, label: RegExp) {
  return page.locator(`a[href="${href}"]:visible`).filter({ hasText: label }).first();
}

async function clickVisibleNavLink(page: Page, href: string, label: RegExp) {
  await visibleNavLink(page, href, label).evaluate((element) => {
    (element as HTMLAnchorElement).click();
  });
}

async function expectFourByThreeFrame(frame: Locator) {
  await expect(frame).toBeVisible();
  const box = await frame.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.width).toBeGreaterThan(80);
  expect(Math.abs((box?.height ?? 0) - (box?.width ?? 0) * 0.75)).toBeLessThanOrEqual(3);
}

async function expectNoPageHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test("home renders the Find form", async ({ page }) => {
  await page.goto("/");
  await expectHeaderSearch(page);
  const themeToggleBox = await page.getByRole("button", { name: /^Toggle theme$/ }).boundingBox();
  const accountBox = await page.getByRole("button", { name: ACCOUNT_BUTTON_NAME }).boundingBox();
  expect(themeToggleBox).not.toBeNull();
  expect(accountBox).not.toBeNull();
  expect(themeToggleBox?.x ?? 0).toBeLessThan(accountBox?.x ?? 0);
  await expect(page.getByRole("link", { name: /KosherTable home/i })).toBeVisible();
  await expect(page.locator('nav a[href="/"]').filter({ hasText: /^Find$/ })).toHaveCount(0);
  await expect(page.locator('a[href="/find"]').filter({ hasText: /^Browse$/ }).first()).toBeAttached();
  await expect(page.locator('a[href="/favorites"]').filter({ hasText: /^Favorites$/ }).first()).toBeAttached();
  await expect(page.locator('a[href="/groceries"]').filter({ hasText: /^Groceries$/ }).first()).toBeAttached();
  await expect(page.getByRole("button", { name: ACCOUNT_BUTTON_NAME })).toBeVisible();
  await expect(page.locator("nav").filter({ hasText: /^Home$/ })).toHaveCount(0);
  await expect(page.getByText("Be specific when you care.")).toHaveCount(0);
  await expect(page.getByRole("switch", { name: /Kosher for Passover/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Find Recipe/i })).toBeVisible();
  await expect(page.getByText("Nightshade & Tomato Safe")).toHaveCount(0);
  await expect(page.getByText("Set the profile once")).toHaveCount(0);
});

test("top-level navigation opens Browse, Favorites, Groceries, and logo home", async ({ page }) => {
  await page.goto("/find");

  await page.getByRole("link", { name: /KosherTable home/i }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: /Find Recipe/i })).toBeVisible();

  await clickVisibleNavLink(page, "/find", /^Browse$/);
  await expect(page).toHaveURL(/\/find$/);
  await expect(page.getByRole("button", { name: /Shuffle/i })).toBeVisible();

  await clickVisibleNavLink(page, "/favorites", /^Favorites$/);
  await expect(page).toHaveURL(/\/favorites$/);
  await expect(page.getByRole("heading", { level: 1, name: /^Favorites$/ })).toBeVisible();

  await clickVisibleNavLink(page, "/groceries", /^Groceries$/);
  await expect(page).toHaveURL(/\/groceries$/);
  await expect(page.getByRole("button", { name: /^Copy list$/ })).toBeVisible();
});

test("header search is visible on browse page", async ({ page }) => {
  await page.goto("/find");
  await expectHeaderSearch(page);
});

test("legacy saved profile hydrates into the shared account UI without a mismatch", async ({ page }) => {
  const hydrationErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /Hydration failed/i.test(message.text())) hydrationErrors.push(message.text());
  });

  await page.goto("/");
  await expectAuthenticated(page);
  await page.evaluate(() => {
    const profile = {
      id: "recipe-profile-jessica",
      name: "Jessica",
      createdAt: "2026-04-28T00:00:00.000Z",
      updatedAt: "2026-04-28T00:00:00.000Z"
    };
    window.localStorage.setItem("koshertable.recipeProfiles.v1", JSON.stringify([profile]));
    window.localStorage.setItem("koshertable.selectedRecipeProfileId.v1", JSON.stringify(profile.id));
  });
  hydrationErrors.length = 0;

  await page.reload();
  await expect(page.getByRole("button", { name: ACCOUNT_BUTTON_NAME })).toBeVisible();
  await expect(page.getByText("Jessica")).toHaveCount(0);
  expect(hydrationErrors).toEqual([]);
});

test("legacy profile favorites and groceries are visible as shared household data", async ({ page }) => {
  await gotoPage(page, "/");
  await expectAuthenticated(page);
  await page.evaluate(() => {
    const now = "2026-04-29T00:00:00.000Z";
    window.localStorage.setItem(
      "koshertable.savedRecipes.v1",
      JSON.stringify([
        {
          id: "legacy-favorite",
          profileId: "recipe-profile-jessica",
          createdAt: now,
          updatedAt: now,
          imagePath: "/images/table-01.svg",
          source: "manual",
          recipe: {
            title: "Legacy Jessica Favorite",
            kosherType: "parve",
            ingredients: [{ name: "Carrots", quantity: "1", unit: "cup" }],
            instructions: ["Cook."],
            prepTimeMinutes: 1,
            cookTimeMinutes: 1,
            servings: 2,
            notes: ""
          }
        }
      ])
    );
    window.localStorage.setItem(
      "koshertable.groceryItems.v1",
      JSON.stringify([
        {
          id: "legacy-grocery",
          profileId: "recipe-profile-jessica",
          ingredientKey: "carrots",
          displayName: "Carrots",
          shoppingName: "carrots",
          quantity: "2",
          unit: "items",
          quantityNotes: [],
          pantryStaple: false,
          checked: false,
          sourceRecipes: [],
          createdAt: now,
          updatedAt: now
        }
      ])
    );
  });

  await gotoPage(page, "/favorites");
  await expect(page.getByText("Legacy Jessica Favorite")).toBeVisible();
  await expect(page.getByText("Saved recipes for")).toHaveCount(0);

  await gotoPage(page, "/groceries");
  await expect(page.locator('[data-testid="grocery-item-name"]:visible').filter({ hasText: "Carrots" })).toBeVisible();
  await expect(page.locator("main").getByText(/Jessica|Matt|Sam/)).toHaveCount(0);
});

test("header search is visible on recipe pages", async ({ page }) => {
  await page.goto("/recipes/catalog-0001");
  await expectHeaderSearch(page);
  await expect(page.locator("article").getByText("Recipe profile")).toHaveCount(0);
  await expectFourByThreeFrame(page.getByTestId("recipe-detail-image-frame"));
  const summaryPanel = page.getByTestId("recipe-detail-summary-panel");
  await expect(summaryPanel).toBeVisible();
  await expect(summaryPanel.getByText("Meat", { exact: true })).toBeVisible();
  const viewport = page.viewportSize();
  if (viewport && viewport.width >= 1024) {
    const imageBox = await page.getByTestId("recipe-detail-image-frame").boundingBox();
    const summaryBox = await summaryPanel.boundingBox();
    expect(imageBox).not.toBeNull();
    expect(summaryBox).not.toBeNull();
    expect(Math.abs((imageBox?.y ?? 0) - (summaryBox?.y ?? 0))).toBeLessThanOrEqual(3);
  }
  const headingSize = await page.getByRole("heading", { level: 1 }).evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(headingSize).toBeLessThanOrEqual(40);
  await expect(page.getByText(/^Checked$/)).toHaveCount(0);
  await expect(page.getByText(/Walmart|Wegmans/i)).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Walmart|Wegmans/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /KŌSH|Grow & Behold|KOL Foods/i }).first()).toBeVisible();
  await expect(page.getByText("Add to groceries")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Add .* to groceries/i }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Add all ingredients/i })).toBeVisible();
});

test("header search opens browse results", async ({ page }) => {
  await page.goto("/recipes/catalog-0001");
  await expectHeaderSearch(page);
  await page.getByRole("textbox", { name: /Search recipes/i }).fill("walleye");
  await expect(page.getByRole("listbox", { name: /Recipe search suggestions/i })).toBeVisible();
  await expect(page.getByRole("option").filter({ hasText: /walleye/i }).first()).toBeVisible();
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

test("find keeps static action buttons and surprise opens a catalog recipe", async ({ page }) => {
  await page.goto("/generate");

  await expect(page.getByText("Give me a recipe")).toHaveCount(0);
  await expect(page.getByText("Create From Selections")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Create recipe from my selections/i })).toHaveCount(0);

  const surpriseButton = page.getByRole("button", { name: /Surprise Me/i });
  const findButton = page.getByRole("button", { name: /Find Recipe/i });
  for (const button of [surpriseButton, findButton]) {
    await expect(button).toHaveClass(/border-input/);
  }
  const buttonHeights = await Promise.all([surpriseButton, findButton].map(async (button) => (await button.boundingBox())?.height));
  const buttonWidths = await Promise.all([surpriseButton, findButton].map(async (button) => (await button.boundingBox())?.width));
  expect(new Set(buttonHeights).size).toBe(1);
  expect(new Set(buttonWidths).size).toBe(1);

  await surpriseButton.click();
  await expect(page).toHaveURL(/\/recipes\/catalog-/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("browse filters by Kosher for Passover, calories, and time", async ({ page }) => {
  await page.goto("/find?mainIngredient=walleye&kosherForPassover=true&maxCaloriesPerServing=400&maxTotalTimeMinutes=45");

  await expectHeaderSearch(page);
  await expect(page.getByRole("heading", { level: 1, name: /^Browse$/ })).toBeAttached();
  await expect(page.getByText("Search nightshade-free, tomato-free kosher meals")).toHaveCount(0);
  await expect(page.getByText("clickable matches from the local catalog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Shuffle/i })).toBeVisible();
  await expect(page.getByText("KFP")).toBeVisible();
  await expect(page.getByTitle("Kosher for Passover")).toBeVisible();
  await expect(page.getByText("Strict no chametz or kitniyot.")).toHaveCount(0);
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
  await expectHeaderSearch(page);

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

test("recipe favorites use the shared household list", async ({ page }) => {
  await page.goto("/recipes/catalog-0001");

  await expect(page.getByRole("button", { name: /^Favorite$/ })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: /^Favorite$/ }).click();
  await expect(page.getByRole("button", { name: /^Favorited$/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /^Favorited$/ }).locator("svg").first()).toHaveAttribute("fill", "currentColor");

  await page.goto("/favorites");
  await expect(page.locator('a[href="/recipes/catalog-0001"]')).toBeVisible();
  await page.goto("/recipes/catalog-0001");
  await expect(page.getByRole("button", { name: /^Favorited$/ })).toBeVisible();
});

test("recipe detail adds ingredients to the grocery list and merges duplicates", async ({ page }) => {
  await gotoPage(page, "/recipes/catalog-0001");

  await page.getByRole("button", { name: /Add .* to groceries/i }).first().click();
  await expect(page.getByRole("status")).toContainText("added to groceries");
  await gotoPage(page, "/groceries");
  await expect(page.locator("input[aria-label^='Quantity for']")).toHaveCount(1);
  await expect(page.getByText(/Mediterranean Lemon Herb/i)).toHaveCount(0);

  await gotoPage(page, "/recipes/catalog-0001");
  await page.getByRole("button", { name: /Add all ingredients/i }).click();
  await expect(page.getByRole("status")).toContainText("added");
  await page.getByRole("button", { name: /Add all ingredients/i }).click();
  await expect(page.getByRole("status")).toContainText("updated");

  await gotoPage(page, "/groceries");
  await expect(page.getByRole("heading", { level: 1, name: /^Groceries$/ })).toBeAttached();
  await expect(page.getByText(/Shopping list for/i)).toHaveCount(0);
  await expect(page.getByText(/Mediterranean Lemon Herb/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Copy Walmart cart prompt/i })).toBeEnabled();
  await expect(page.getByRole("button", { name: /Open Walmart searches/i })).toHaveCount(0);
  await expect(page.getByText("Walmart order agent links")).toHaveCount(0);
  const meatPanels = page.getByTestId("meat-store-panels");
  await expect(meatPanels).toBeVisible();
  await expect(meatPanels.getByRole("heading", { name: /KŌSH|Grow & Behold|KOL Foods|Specialty kosher/ }).first()).toBeVisible();
  await expect(meatPanels.getByText(/Walmart|Wegmans/i)).toHaveCount(0);
  await expect(meatPanels.getByRole("link", { name: /Walmart|Wegmans/i })).toHaveCount(0);

  const viewport = page.viewportSize();
  if (viewport && viewport.width >= 768) {
    const firstItem = page.locator("input[aria-label^='Quantity for']").first();
    await firstItem.fill("3");
    await expect(firstItem).toHaveValue("3");
  } else {
    await expect(page.getByTestId("grocery-edit-row").first().getByRole("textbox")).toHaveCount(0);
    await expect(page.getByTestId("grocery-item-amount").first()).toBeVisible();
  }

  const firstName = page.locator('[data-testid="grocery-item-name"]:visible').first();
  const firstNameText = await firstName.textContent();
  await firstName.click();
  await expect(page.locator('[data-testid="grocery-item-name"]:visible').last()).toContainText(firstNameText?.trim() ?? "");
  await page.getByRole("button", { name: /^Clear checked$/ }).click();
  if (viewport && viewport.width >= 768) {
    await expect(page.locator("input[aria-label^='Quantity for']").first()).toHaveCount(1);
  } else {
    expect(await page.getByTestId("grocery-edit-row").count()).toBeGreaterThan(0);
  }

  await page.getByRole("link", { name: /^Store view$/ }).click();
  await expect(page).toHaveURL(/\/groceries\?view=store$/);
  await expect(page.getByRole("heading", { name: /^Store checklist$/ })).toBeVisible();
  await expect(page.getByRole("form", { name: /Add custom grocery item/i })).toHaveCount(0);
  await expect(page.locator("input[aria-label^='Quantity for']")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Remove$/ })).toHaveCount(0);
  await expect(page.getByTestId("meat-store-panels")).toHaveCount(0);

  const firstStoreItem = page.getByTestId("store-grocery-item-name").first();
  const firstStoreItemText = await firstStoreItem.textContent();
  await page.getByTestId("store-grocery-row").first().click();
  await expect(page.getByTestId("store-grocery-item-name").last()).toContainText(firstStoreItemText?.trim() ?? "");
  await expect(page.getByRole("link", { name: /^Edit view$/ })).toBeVisible();
});

test("groceries use the shared household list and support custom items", async ({ page }) => {
  await page.goto("/groceries");
  await expect(page.getByRole("button", { name: ACCOUNT_BUTTON_NAME })).toBeVisible();
  await expect(page.locator("main").getByText("Recipe profile")).toHaveCount(0);

  const customForm = page.getByRole("form", { name: /Add custom grocery item/i });
  await customForm.getByRole("textbox", { name: /^Custom grocery item$/ }).fill("call");
  await expect(customForm.getByRole("option", { name: /Cauliflower rice/i })).toBeVisible();
  await customForm.getByRole("option", { name: /Cauliflower rice/i }).click();
  await expect(customForm.getByRole("textbox", { name: /^Custom grocery item$/ })).toHaveValue("Cauliflower rice");
  await expect(customForm.getByRole("textbox", { name: /^Custom grocery quantity$/ })).toHaveValue("3");
  await expect(customForm.getByRole("textbox", { name: /^Custom grocery unit$/ })).toHaveValue("cups");
  await customForm.getByRole("button", { name: /^Add$/ }).click();
  await expect(page.locator('[data-testid="grocery-item-name"]:visible').filter({ hasText: "Cauliflower rice" })).toBeVisible();
  await page.getByRole("button", { name: /^Remove$/ }).click();
  await expect(page.getByText("Cauliflower rice")).toHaveCount(0);
});

test("grocery edit list stays compact on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoPage(page, "/");
  await page.evaluate(() => {
    const now = "2026-04-30T00:00:00.000Z";
    window.localStorage.setItem(
      "koshertable.groceryItems.v1",
      JSON.stringify([
        {
          id: "mobile-carrots",
          profileId: "household",
          ingredientKey: "carrots",
          displayName: "Carrots",
          shoppingName: "carrots",
          quantity: "1/2",
          unit: "cup",
          quantityNotes: [],
          pantryStaple: false,
          checked: false,
          sourceRecipes: [],
          createdAt: now,
          updatedAt: now
        },
        {
          id: "mobile-apples",
          profileId: "household",
          ingredientKey: "apples",
          displayName: "Apples",
          shoppingName: "apples",
          quantity: "6",
          unit: "items",
          quantityNotes: [],
          pantryStaple: false,
          checked: false,
          sourceRecipes: [],
          createdAt: now,
          updatedAt: now
        }
      ])
    );
  });

  await gotoPage(page, "/groceries");
  await expectNoPageHorizontalOverflow(page);
  const firstRow = page.getByTestId("grocery-edit-row").first();
  await expect(firstRow).toBeVisible();
  const firstRowBox = await firstRow.boundingBox();
  const nameBox = await firstRow.locator('[data-testid="grocery-item-name"]:visible').boundingBox();
  const amountBox = await firstRow.getByTestId("grocery-item-amount").boundingBox();

  expect(firstRowBox).not.toBeNull();
  expect(nameBox).not.toBeNull();
  expect(amountBox).not.toBeNull();
  expect(firstRowBox?.height ?? 999).toBeLessThan(92);
  expect(Math.abs((nameBox?.x ?? 0) - (amountBox?.x ?? 0))).toBeLessThanOrEqual(2);
  await expect(firstRow.getByRole("textbox")).toHaveCount(0);
  await expect(firstRow.getByRole("button", { name: /^Remove$/ })).toBeVisible();
});

test("grocery clear actions can be undone", async ({ page }) => {
  await gotoPage(page, "/");
  await page.evaluate(() => {
    const now = "2026-04-30T00:00:00.000Z";
    window.localStorage.setItem(
      "koshertable.groceryItems.v1",
      JSON.stringify([
        {
          id: "undo-apples",
          profileId: "household",
          ingredientKey: "apples",
          displayName: "Apples",
          shoppingName: "apples",
          quantity: "6",
          unit: "items",
          quantityNotes: [],
          pantryStaple: false,
          checked: true,
          sourceRecipes: [],
          createdAt: now,
          updatedAt: now
        },
        {
          id: "undo-carrots",
          profileId: "household",
          ingredientKey: "carrots",
          displayName: "Carrots",
          shoppingName: "carrots",
          quantity: "2",
          unit: "cups",
          quantityNotes: [],
          pantryStaple: false,
          checked: false,
          sourceRecipes: [],
          createdAt: now,
          updatedAt: now
        }
      ])
    );
  });

  await gotoPage(page, "/groceries");
  const visibleNames = page.locator('[data-testid="grocery-item-name"]:visible');
  await expect(visibleNames.filter({ hasText: "Apples" })).toBeVisible();
  await expect(visibleNames.filter({ hasText: "Carrots" })).toBeVisible();

  await page.getByRole("button", { name: /^Clear checked$/ }).click();
  await expect(page.getByRole("status")).toContainText("1 checked item cleared.");
  await expect(visibleNames.filter({ hasText: "Apples" })).toHaveCount(0);
  await expect(visibleNames.filter({ hasText: "Carrots" })).toBeVisible();
  await page.getByRole("button", { name: /^Undo$/ }).click();
  await expect(page.getByRole("status")).toContainText("1 item restored.");
  await expect(visibleNames.filter({ hasText: "Apples" })).toBeVisible();
  await expect(visibleNames.filter({ hasText: "Carrots" })).toBeVisible();

  await page.getByRole("button", { name: /^Clear all$/ }).click();
  await expect(page.getByRole("status")).toContainText("2 grocery items cleared.");
  await expect(page.getByText("Add ingredients from a recipe or create a custom grocery item.")).toBeVisible();
  await page.getByRole("button", { name: /^Undo$/ }).click();
  await expect(page.getByRole("status")).toContainText("2 items restored.");
  await expect(visibleNames.filter({ hasText: "Apples" })).toBeVisible();
  await expect(visibleNames.filter({ hasText: "Carrots" })).toBeVisible();
});

test("favorites page lists shared household recipes", async ({ page }) => {
  await gotoPage(page, "/favorites");
  await expectHeaderSearch(page);
  await expect(page.getByRole("heading", { level: 1, name: /^Favorites$/ })).toBeVisible();
  await expect(page.locator("main").getByText("Recipe profile")).toHaveCount(0);
  await expect(page.getByText("No favorites yet")).toBeVisible();
  await expect(page.getByRole("link", { name: /Browse recipes/i })).toHaveAttribute("href", "/find");

  await gotoPage(page, "/recipes/catalog-0001");
  await page.getByRole("button", { name: /^Favorite$/ }).click();
  await expect(page.getByRole("button", { name: /^Favorited$/ })).toHaveAttribute("aria-pressed", "true");

  await gotoPage(page, "/favorites");
  await expect(page.locator('a[href="/recipes/catalog-0001"]')).toBeVisible();
  await expectFourByThreeFrame(page.getByTestId("recipe-card-image-frame").first());
  await expect(page.getByText("No favorites yet")).toHaveCount(0);
  await page.getByRole("button", { name: /^Add groceries$/ }).click();
  await expect(page.getByRole("status")).toContainText(/added|updated/);
  await gotoPage(page, "/groceries");
  await expect(page.getByText(/Mediterranean Lemon Herb/i)).toHaveCount(0);
  await gotoPage(page, "/favorites");
  await expect(page.getByRole("button", { name: /^Unfavorite$/ })).toBeVisible();
  await expect(page.locator('a[href="/recipes/catalog-0001"]')).toBeVisible();
  await page.getByRole("button", { name: /^Unfavorite$/ }).click();
  await expect(page).toHaveURL(/\/favorites$/);
  await expect(page.locator('a[href="/recipes/catalog-0001"]')).toHaveCount(0);
  await expect(page.getByText("No favorites yet")).toBeVisible();
});
