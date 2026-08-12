import { defineConfig, devices } from "@playwright/test";

const port = 4000;
const baseURL = `http://127.0.0.1:${port}`;
const startCommand = process.platform === "win32"
  ? "C:\\Users\\ozand\\AppData\\Roaming\\npm\\pnpm.cmd start --hostname 127.0.0.1 --port 4000"
  : "pnpm start --hostname 127.0.0.1 --port 4000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  ...(process.env.CI
    ? {
        webServer: {
          command: startCommand,
          url: baseURL,
          reuseExistingServer: false,
          timeout: 180000,
          env: {
            ...process.env,
            NEXT_PUBLIC_APP_URL: baseURL,
            AUTH_URL: baseURL,
            NEXTAUTH_URL: baseURL,
          },
        },
      }
    : {}),
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
