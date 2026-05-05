import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3100";
const authEnv = [
  "NEXT_PUBLIC_FIREBASE_API_KEY=test-api-key",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID=koshertable-prod",
  "NEXT_PUBLIC_GOOGLE_CLIENT_ID=test-client-id.apps.googleusercontent.com"
].join(" ");

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  workers: 2,
  expect: {
    timeout: 5_000
  },
  use: {
    baseURL
  },
  webServer: {
    command: `${authEnv} npm run dev -- --hostname 127.0.0.1 --port 3100`,
    url: baseURL,
    reuseExistingServer: !process.env.CI
  },
  projects: [
    { name: "iphone", use: { ...devices["iPhone 15"] } },
    { name: "pixel", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } }
  ]
});
