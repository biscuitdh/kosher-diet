import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
});

test("dashboard renders primary CTA", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Find Meal Ideas/i }).first()).toBeVisible();
  await expect(page.getByText("Nightshade & Tomato Safe")).toHaveCount(0);
  await expect(page.getByText("Set the profile once")).toHaveCount(0);
});

test("onboarding redirects to generator", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/generate$/);
  await expect(page.getByRole("heading", { name: /Find meal ideas/i })).toBeVisible();
});

test("generator renders recipe form", async ({ page }) => {
  await page.goto("/generate");
  await expect(page.getByRole("heading", { name: /Find meal ideas/i })).toBeVisible();
  await expect(page.getByLabel(/Search by recipe name/i)).toBeVisible();
  await expect(page.getByRole("switch", { name: /Kosher for Passover/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Surprise Me/i })).toBeVisible();
  await expect(page.getByText("Free testing mode")).toHaveCount(0);
});

test("generator stores recent Passover walleye searches", async ({ page }) => {
  await page.goto("/generate");
  const mainIngredientInput = page.getByLabel(/Main protein or veggie/i);
  const passoverSwitch = page.getByRole("switch", { name: /Kosher for Passover/i });
  const firstMatch = page.getByTestId("recipe-match-card").first();
  const recentWalleyeSearch = page.getByRole("button", { name: /walleye.*Passover.*<=400 cal.*<=45 min/i });

  await page.waitForFunction(() => window.localStorage.getItem("koshertable.finderDraft.v1") !== null);
  await mainIngredientInput.fill("walleye");
  await expect(mainIngredientInput).toHaveValue("walleye");
  await passoverSwitch.click();
  await expect(passoverSwitch).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "≤400" }).click();
  await expect(page.getByRole("button", { name: "≤400" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "≤45 min" }).click();
  await expect(page.getByRole("button", { name: "≤45 min" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /Find Recipe/i }).click();

  await expect(page).toHaveURL(/\/generate$/);
  await expect(page.getByTestId("recipe-match-card")).toHaveCount(18);
  await expect(firstMatch).toContainText(/walleye/i);
  await expect(page.getByRole("button", { name: "≤400" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "≤45 min" })).toHaveAttribute("aria-pressed", "true");

  await expect(recentWalleyeSearch).toBeVisible();

  await recentWalleyeSearch.click();
  await expect(mainIngredientInput).toHaveValue("walleye");
  await expect(passoverSwitch).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("button", { name: "≤400" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "≤45 min" })).toHaveAttribute("aria-pressed", "true");

  await firstMatch.click();
  await expect(page).toHaveURL(/\/recipes\/catalog-/);
  await expect(page.getByText("Safety check passed")).toHaveCount(0);
});
