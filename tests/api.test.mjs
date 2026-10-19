import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchPhotos, trackDownload } from "../src/api.js";
import { photo, success } from "./fixtures.mjs";

const accessKey = "test-client-id";
const response = (body = success().data, status = 200) => ({
    ok: status < 400,
    status,
    json: async () => body,
});

test("search encodes query and filters, authenticates in a header, and forwards cancellation", async () => {
    const controller = new AbortController();
    const result = await fetchPhotos("café & sea", {
        accessKey,
        page: 2,
        orientation: "portrait",
        orderBy: "latest",
        signal: controller.signal,
        fetchImpl: async (url, options) => {
            const parsed = new URL(url);
            assert.equal(parsed.origin, "https://api.unsplash.com");
            assert.deepEqual(Object.fromEntries(parsed.searchParams), {
                query: "café & sea",
                page: "2",
                per_page: "12",
                order_by: "latest",
                content_filter: "high",
                orientation: "portrait",
            });
            assert.equal(options.headers.Authorization, `Client-ID ${accessKey}`);
            assert.equal(options.headers["Accept-Version"], "v1");
            assert.equal(options.signal, controller.signal);
            assert.equal(options.redirect, "error");
            return response();
        },
    });
    assert.deepEqual(result, success());
});

test("default search omits orientation and never requests without a key", async () => {
    assert.equal((await fetchPhotos("sea")).error.code, "missing-key");
    const result = await fetchPhotos("sea", {
        accessKey,
        fetchImpl: async (url) => {
            const params = new URL(url).searchParams;
            assert.equal(params.has("orientation"), false);
            assert.equal(params.get("page"), "1");
            return response({ results: [], total: 0, total_pages: 0 });
        },
    });
    assert.equal(result.ok, true);
});

for (const [status, code] of [
    [401, "unauthorized"],
    [403, "rate-limit"],
    [429, "rate-limit"],
    [500, "http"],
]) {
    test(`search returns a useful ${code} error for HTTP ${status}`, async () => {
        const result = await fetchPhotos("sea", { accessKey, fetchImpl: async () => response(null, status) });
        assert.equal(result.ok, false);
        assert.equal(result.error.code, code);
        assert.ok(result.error.message.length);
    });
}

test("network failures and aborts become explicit results", async () => {
    for (const [error, code] of [
        [new TypeError("offline"), "network"],
        [new DOMException("cancel", "AbortError"), "aborted"],
    ]) {
        const result = await fetchPhotos("sea", {
            accessKey,
            fetchImpl: async () => {
                throw error;
            },
        });
        assert.equal(result.error.code, code);
    }
});

test("non-Error fetch rejections remain safe structured failures", async () => {
    for (const rejection of [null, undefined, "offline"]) {
        const result = await fetchPhotos("sea", {
            accessKey,
            fetchImpl: async () => {
                throw rejection;
            },
        });
        assert.equal(result.ok, false);
        assert.equal(result.error.code, "network");
    }
});

test("invalid JSON and incomplete photo/search data cannot reach the renderer", async () => {
    const invalidJson = await fetchPhotos("sea", {
        accessKey,
        fetchImpl: async () => ({
            ok: true,
            json: async () => {
                throw new SyntaxError();
            },
        }),
    });
    assert.equal(invalidJson.error.code, "invalid-response");
    for (const data of [
        null,
        {},
        { results: [], total: -1, total_pages: 0 },
        { results: [], total: 0, total_pages: 0.5 },
        { results: [{}], total: 1, total_pages: 1 },
        { results: [photo("bad", { width: 0 })], total: 1, total_pages: 1 },
        { results: [photo("bad", { alt_description: 42 })], total: 1, total_pages: 1 },
    ]) {
        const result = await fetchPhotos("sea", { accessKey, fetchImpl: async () => response(data) });
        assert.equal(result.error.code, "invalid-response");
    }
});

test("download tracking sends authorization and returns failures without throwing", async () => {
    const url = "https://api.unsplash.com/photos/abc/download?ixid=123";
    const result = await trackDownload(url, {
        accessKey,
        fetchImpl: async (actual, options) => {
            assert.equal(actual, url);
            assert.equal(options.headers.Authorization, `Client-ID ${accessKey}`);
            assert.equal(options.redirect, "error");
            return response({ url: "https://images.unsplash.com/full" });
        },
    });
    assert.equal(result.ok, true);
    assert.equal((await trackDownload(url)).error.code, "missing-key");
    assert.equal(
        (
            await trackDownload(url, {
                accessKey,
                fetchImpl: async () => {
                    throw new Error("offline");
                },
            })
        ).error.code,
        "network",
    );
});

test("download tracking never sends the key to a foreign or invalid endpoint", async () => {
    for (const url of [
        undefined,
        "broken",
        "http://api.unsplash.com/photos/a/download",
        "https://example.com/photos/a/download",
        "https://api.unsplash.com.evil.test/photos/a/download",
        "https://user:password@api.unsplash.com/photos/a/download",
        "https://api.unsplash.com/search/photos",
        "https://api.unsplash.com/photos/a/download/extra",
    ]) {
        const result = await trackDownload(url, {
            accessKey,
            fetchImpl: () => assert.fail("must not fetch"),
        });
        assert.equal(result.error.code, "invalid-url");
    }
});
