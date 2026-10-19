import assert from "node:assert/strict";
import { test } from "node:test";
import { createSearchController, normalizeQuery } from "../src/search.js";
import { deferred, photo, success } from "./fixtures.mjs";
import { getAccessKey, getStorage, readStored, writeStored, STORAGE } from "../src/config.js";

test("access keys prefer valid config, fall back to browser storage, and trim whitespace", () => {
    const storage = { getItem: () => " saved " };
    assert.equal(getAccessKey({ UNSPLASH_ACCESS_KEY: " configured " }, storage), "configured");
    for (const config of [undefined, null, {}, { UNSPLASH_ACCESS_KEY: 42 }, { UNSPLASH_ACCESS_KEY: " " }]) {
        assert.equal(getAccessKey(config, storage), "saved");
    }
    assert.equal(getAccessKey(), "");
    assert.equal(getAccessKey({}, { getItem: () => null }), "");
});

test("storage denial cannot crash configuration or preference changes", () => {
    const storage = {
        getItem() {
            throw new Error();
        },
        setItem() {
            throw new Error();
        },
    };
    assert.equal(readStored(storage, STORAGE.theme), "");
    assert.equal(writeStored(storage, STORAGE.theme, "light"), false);
    assert.equal(writeStored(null, STORAGE.theme, "light"), false);
    assert.equal(
        getStorage({
            get localStorage() {
                throw new Error();
            },
        }),
        null,
    );
    assert.equal(getStorage({ localStorage: storage }), storage);
    const values = new Map();
    const working = {
        setItem: (key, value) => values.set(key, value),
        removeItem: (key) => values.delete(key),
    };
    assert.equal(writeStored(working, STORAGE.theme, "light"), true);
    assert.equal(values.get(STORAGE.theme), "light");
    assert.equal(writeStored(working, STORAGE.theme, ""), true);
    assert.equal(values.has(STORAGE.theme), false);
});

test("queries normalize whitespace and blank searches leave the state alone", async () => {
    assert.equal(normalizeQuery("  café\n  sea "), "café sea");
    const search = createSearchController({
        fetchPhotos: () => assert.fail(),
        onChange: () => assert.fail(),
    });
    assert.equal(await search.search("  "), false);
    assert.equal(await search.refresh(), false);
    assert.equal(await search.loadMore(), false);
    assert.equal(search.getState().query, "");
});

test("search and filters start at page one, pagination appends and stops at the last page", async () => {
    const calls = [];
    const snapshots = [];
    const search = createSearchController({
        fetchPhotos: async (query, options) => {
            calls.push({ query, ...options });
            return success([photo(`${query}-${options.page}`)]);
        },
        onChange: (state) => snapshots.push(state),
    });
    await search.search(" sea ");
    await search.loadMore();
    assert.equal(search.getState().photos.length, 2);
    assert.equal(await search.loadMore(), false);
    await search.refresh({ orientation: "portrait", orderBy: "latest" });
    assert.equal(search.getState().photos.length, 1);
    assert.equal(search.getState().page, 1);
    assert.equal(calls[2].orientation, "portrait");
    assert.equal(calls[2].orderBy, "latest");
    assert.equal(snapshots[0].loading, true);
    assert.equal(snapshots[0].page, 0);
    assert.equal(snapshots.at(-1).loading, false);
});

test("a failed next page preserves photos and retries that same page", async () => {
    let fail = true;
    const pages = [];
    const search = createSearchController({
        fetchPhotos: async (_, { page }) => {
            pages.push(page);
            if (page === 2 && fail) return { ok: false, error: { code: "network", message: "Offline" } };
            return success([photo(`photo-${page}`)], 3);
        },
        onChange() {},
    });
    await search.search("sea");
    await search.loadMore();
    assert.equal(search.getState().page, 1);
    assert.equal(search.getState().photos.length, 1);
    assert.equal(search.getState().error.code, "network");
    fail = false;
    await search.loadMore();
    assert.deepEqual(pages, [1, 2, 2]);
    assert.equal(search.getState().error, null);
    assert.equal(search.getState().page, 2);
});

test("stale success and stale failure cannot overwrite a newer search even if abort is ignored", async () => {
    for (const stale of [
        success([photo("old")]),
        { ok: false, error: { code: "network", message: "Old error" } },
    ]) {
        const older = deferred();
        let signal;
        const search = createSearchController({
            fetchPhotos: (query, options) => {
                if (query === "old") {
                    signal = options.signal;
                    return older.promise;
                }
                return Promise.resolve(success([photo("new")]));
            },
            onChange() {},
        });
        const pending = search.search("old");
        await search.search("new");
        assert.equal(signal.aborted, true);
        older.resolve(stale);
        await pending;
        assert.equal(search.getState().photos[0].id, "new");
        assert.equal(search.getState().error, null);
        assert.equal(search.getState().loading, false);
    }
});

test("repeated load-more clicks do not request duplicate pages", async () => {
    const nextPage = deferred();
    const search = createSearchController({
        fetchPhotos: (_, { page }) => (page === 1 ? Promise.resolve(success()) : nextPage.promise),
        onChange() {},
    });
    await search.search("sea");
    const pending = search.loadMore();
    assert.equal(await search.loadMore(), false);
    nextPage.resolve(success([photo("page-2")]));
    await pending;
    assert.equal(search.getState().photos.length, 2);
});
