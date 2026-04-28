import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  use: {
    baseURL
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: baseURL,
    reuseExistingServer: !process.env.CI
  },
  projects: [
    { name: "iphone", use: { ...devices["iPhone 15"] } },
    { name: "pixel", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } }
  ]
});
