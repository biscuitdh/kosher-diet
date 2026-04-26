import { expect, test } from "@playwright/test";

test("dashboard renders primary CTA", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Generate Meal Ideas/i }).first()).toBeVisible();
  await expect(page.getByText("Nightshade & Tomato Safe")).toBeVisible();
  await expect(page.getByText("Set the profile once")).toHaveCount(0);
});

test("onboarding redirects to generator", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/generate$/);
  await expect(page.getByRole("heading", { name: /Generate meal ideas/i })).toBeVisible();
});

test("generator renders recipe form", async ({ page }) => {
  await page.goto("/generate");
  await expect(page.getByRole("heading", { name: /Generate meal ideas/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Surprise Me/i })).toBeVisible();
});
