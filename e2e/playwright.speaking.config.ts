import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/speaking",
  testMatch: [
    "speaking-history-cli.spec.ts",
    "speaking-selection-translate-tooltip.spec.ts",
  ],
  workers: 1,
  retries: 0,
  timeout: 60000,
  expect: { timeout: 10000 },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report/speaking" }],
  ],
  outputDir: "test-results/speaking",
  use: {
    ...devices["Desktop Chrome"],
    channel: "chrome",
    baseURL: "http://localhost:4380",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15000,
    permissions: ["microphone"],
    launchOptions: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        "--autoplay-policy=no-user-gesture-required",
      ],
    },
  },
});
