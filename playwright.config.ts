import { defineConfig, devices } from "@playwright/test";

// `*.e2e.ts`, not `*.spec.ts`: Vitest would pick those up.
export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  forbidOnly: !!process.env.CI,
  use: { baseURL: "http://localhost:3100" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
