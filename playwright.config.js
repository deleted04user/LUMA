import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: "./tests/browser",
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: 0,
    workers: process.env.CI ? 2 : 3,
    reporter: [["list"], ["html", { open: "never" }]],
    use: { baseURL: "http://127.0.0.1:8000", trace: "retain-on-failure", screenshot: "only-on-failure" },
    projects: [
        { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
        { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
        { name: "desktop-firefox", use: { ...devices["Desktop Firefox"] } },
    ],
    webServer: {
        command: "npm run preview",
        url: "http://127.0.0.1:8000",
        reuseExistingServer: false,
    },
});
