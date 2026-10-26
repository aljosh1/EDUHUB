import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests require a configured Supabase backend with seeded users:
 *   user-a@paperstack.test / paperstack-a
 *   user-b@paperstack.test / paperstack-b
 * Set these credentials in tests/e2e/.env.test or environment variables
 * (E2E_USER_A_PASSWORD, E2E_USER_B_PASSWORD) before running `npm run e2e`.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
