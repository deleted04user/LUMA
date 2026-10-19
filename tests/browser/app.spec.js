import { test as base, expect } from "@playwright/test";
import { photo } from "../fixtures.mjs";

const test = base.extend({
    pageErrors: [
        async ({ page }, use) => {
            const errors = [];
            page.on("pageerror", (error) => errors.push(error.message));
            await use(errors);
            expect(errors).toEqual([]);
        },
        { auto: true },
    ],
});
const endpoint = "https://api.unsplash.com/search/photos?**";
const body = (results = [photo()], totalPages = 2) => ({
    results,
    total: results.length ? 24 : 0,
    total_pages: totalPages,
});

test.beforeEach(async ({ page }) => {
    await page.route("https://images.unsplash.com/**", (route) =>
        route.fulfill({
            contentType: "image/svg+xml",
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="100%" height="100%" fill="#536e81"/></svg>',
        }),
    );
});

async function openConfigured(page) {
    await page.addInitScript(() => localStorage.setItem("luma-unsplash-access-key", "browser-test-key"));
    await page.goto("/");
}

async function search(page, query) {
    await page.getByRole("searchbox").fill(query);
    await page.getByRole("button", { name: "Search", exact: true }).click();
}

test("first-run setup validates the key and enables a real UI search", async ({ page }) => {
    let requests = 0;
    await page.route(endpoint, (route) => {
        requests++;
        return route.fulfill({ json: body() });
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Connect Unsplash to search" })).toBeVisible();
    await search(page, "sea");
    await expect(page.getByRole("button", { name: "Check Access Key" })).toBeVisible();
    expect(requests).toBe(0);
    await page.getByRole("button", { name: "Check Access Key" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.locator("#toast")).toContainText("Enter a valid");
    await page.getByLabel("Access Key", { exact: true }).fill("browser-test-key");
    await page.getByLabel("Access Key", { exact: true }).press("Enter");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.locator(".photo-card")).toHaveCount(1);
    expect(requests).toBe(1);
});

test("configured keys are available before the module starts and blank queries do not search", async ({
    page,
}) => {
    await page.route("http://127.0.0.1:8000/config.js", (route) =>
        route.fulfill({
            contentType: "text/javascript",
            body: 'window.LUMA_CONFIG = { UNSPLASH_ACCESS_KEY: "configured-test-key" };',
        }),
    );
    let calls = 0;
    await page.route(endpoint, (route) => {
        calls++;
        expect(route.request().headers().authorization).toBe("Client-ID configured-test-key");
        return route.fulfill({ json: body() });
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Start with an idea" })).toBeVisible();
    await search(page, "   ");
    await expect(page.locator("#toast")).toContainText("Enter something to search for");
    expect(calls).toBe(0);
    await search(page, "sea");
    await expect(page.locator(".photo-card")).toHaveCount(1);
    expect(calls).toBe(1);
});

test("search, filters, sorting, suggestions, and final-page pagination work together", async ({ page }) => {
    const calls = [];
    await page.route(endpoint, (route) => {
        const url = new URL(route.request().url());
        calls.push(Object.fromEntries(url.searchParams));
        expect(route.request().headers().authorization).toBe("Client-ID browser-test-key");
        return route.fulfill({ json: body([photo(`page-${url.searchParams.get("page")}`)]) });
    });
    await openConfigured(page);
    await search(page, "  sea  coast ");
    await expect(page.getByRole("heading", { name: "24 results for “sea coast”" })).toBeVisible();
    await page.getByRole("button", { name: "Load more photos" }).click();
    await expect(page.locator(".photo-card")).toHaveCount(2);
    await expect(page.locator("#show-more-btn")).toBeHidden();
    await page.getByLabel("Orientation").selectOption("portrait");
    await expect(page.locator(".photo-card")).toHaveCount(1);
    await page.getByRole("combobox", { name: "Sort", exact: true }).selectOption("latest");
    await expect.poll(() => calls.at(-1)?.order_by).toBe("latest");
    await page.getByRole("button", { name: "Nature", exact: true }).click();
    await expect(page.getByRole("heading", { name: "24 results for “Nature”" })).toBeVisible();
    expect(calls.map((call) => call.page)).toEqual(["1", "2", "1", "1", "1"]);
    expect(calls.at(-1)).toMatchObject({
        orientation: "portrait",
        order_by: "latest",
        content_filter: "high",
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("empty, invalid-key, rate-limit, network, and malformed responses have recovery states", async ({
    page,
}) => {
    await page.route(endpoint, (route) => {
        const query = new URL(route.request().url()).searchParams.get("query");
        if (query === "offline") return route.abort("failed");
        if (query === "empty") return route.fulfill({ json: body([], 0) });
        if (query === "invalid") return route.fulfill({ status: 401, json: {} });
        if (query === "limit") return route.fulfill({ status: 429, json: {} });
        return route.fulfill({ json: { results: [{}], total: 1, total_pages: 1 } });
    });
    await openConfigured(page);
    for (const [query, message] of [
        ["empty", "No photos found"],
        ["invalid", "That Access Key was not accepted"],
        ["limit", "rate limit has been reached"],
        ["offline", "Could not reach Unsplash"],
        ["malformed", "incomplete photo data"],
    ]) {
        await search(page, query);
        await expect(page.locator("#status-panel")).toContainText(message);
        await expect(page.locator(".skeleton")).toHaveCount(0);
        await expect(page.locator("#show-more-btn")).toBeHidden();
    }
});

test("a failed load-more request retries page two without losing existing photos", async ({ page }) => {
    const pages = [];
    let attempts = 0;
    await page.route(endpoint, (route) => {
        const pageNumber = new URL(route.request().url()).searchParams.get("page");
        pages.push(pageNumber);
        if (pageNumber === "2" && attempts++ === 0) return route.abort("failed");
        return route.fulfill({ json: body([photo(`page-${pageNumber}`)], 3) });
    });
    await openConfigured(page);
    await search(page, "sea");
    await expect(page.locator(".photo-card")).toHaveCount(1);
    await page.getByRole("button", { name: "Load more photos" }).click();
    await expect(page.locator("#status-panel")).toContainText("Could not reach Unsplash");
    await expect(page.locator(".photo-card")).toHaveCount(1);
    await page.getByRole("button", { name: "Load more photos" }).click();
    await expect(page.locator(".photo-card")).toHaveCount(2);
    expect(pages).toEqual(["1", "2", "2"]);
});

test("theme persists after reload and removing a key shows setup guidance", async ({ page }) => {
    await openConfigured(page);
    const initial = await page.locator("html").getAttribute("data-theme");
    await page.getByRole("button", { name: /Switch to .* theme/ }).click();
    const next = initial === "dark" ? "light" : "dark";
    await expect(page.locator("html")).toHaveAttribute("data-theme", next);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", next);
    await page.getByRole("button", { name: "API setup" }).click();
    await page.getByRole("button", { name: "Remove saved key" }).click();
    await page.getByRole("button", { name: "Close settings" }).click();
    await expect(page.getByRole("heading", { name: "Connect Unsplash to search" })).toBeVisible();
});

test("storage restrictions allow theme changes and temporary key setup without crashes", async ({ page }) => {
    await page.addInitScript(() => {
        for (const method of ["getItem", "setItem", "removeItem"])
            Storage.prototype[method] = () => {
                throw new Error("Storage blocked");
            };
    });
    await page.route(endpoint, (route) => route.fulfill({ json: body() }));
    await page.goto("/");
    await page.getByRole("button", { name: /Switch to .* theme/ }).click();
    await page.getByRole("button", { name: "API setup" }).click();
    await page.getByLabel("Access Key", { exact: true }).fill("temporary-key");
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(page.locator("#toast")).toContainText("for this tab");
    await search(page, "sea");
    await expect(page.locator(".photo-card")).toHaveCount(1);
});

test("download tracking authenticates, preserves query parameters, and reports failures", async ({
    page,
}) => {
    const value = photo();
    value.links.download += "?ixid=example";
    await page.route(endpoint, (route) => route.fulfill({ json: body([value]) }));
    let authorization;
    await page.route(value.links.download_location, (route) => {
        authorization = route.request().headers().authorization;
        return route.abort("failed");
    });
    await openConfigured(page);
    await search(page, "sea");
    const download = page.getByRole("link", { name: "Download photo from Unsplash" });
    await expect(download).toHaveAttribute("href", /\?ixid=example&force=true$/);
    await download.evaluate((link) => link.addEventListener("click", (event) => event.preventDefault()));
    await download.click();
    await expect(page.locator("#toast")).toContainText("Download tracking failed");
    expect(authorization).toBe("Client-ID browser-test-key");
});
