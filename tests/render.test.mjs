import assert from "node:assert/strict";
import { test } from "node:test";
import {
    createPhotoCard,
    withReferral,
    renderStatus,
    renderSkeletons,
    createRenderer,
} from "../src/render.js";
import { createDom } from "./dom.mjs";
import { photo } from "./fixtures.mjs";

test("referral URLs preserve query/hash and replace existing referral parameters", () => {
    const url = new URL(withReferral("https://unsplash.com/@ada?x=1&utm_source=old#photos"));
    assert.equal(url.searchParams.get("x"), "1");
    assert.equal(url.searchParams.get("utm_source"), "luma_search");
    assert.equal(url.searchParams.get("utm_medium"), "referral");
    assert.equal(url.hash, "#photos");
    for (const value of [
        "broken",
        "javascript:alert(1)",
        "https://user:pass@unsplash.com/",
        "https://evil.test/",
    ]) {
        assert.equal(new URL(withReferral(value)).origin, "https://unsplash.com");
    }
});

test("photo cards expose accessible attribution, responsive images and valid download URLs", () => {
    const { document } = createDom();
    let tracked;
    const card = createPhotoCard(photo(), {
        document,
        onDownload: (url) => {
            tracked = url;
        },
    });
    const image = card.querySelector("img");
    assert.equal(image.alt, "Mountain at sunrise");
    assert.equal(image.width, 1200);
    assert.equal(image.height, 800);
    assert.equal(image.loading, "lazy");
    assert.match(image.srcset, /400w.*1080w/);
    assert.equal(card.querySelector(".photographer").textContent, "Ada Photographer");
    for (const link of card.querySelectorAll("a")) {
        assert.equal(link.rel, "noopener noreferrer");
        assert.equal(link.target, "_blank");
        assert.ok(link.getAttribute("aria-label"));
        link.addEventListener("click", (event) => event.preventDefault());
    }
    const download = card.querySelector('[aria-label="Download photo from Unsplash"]');
    assert.equal(new URL(download.href).searchParams.get("force"), "true");
    download.click();
    assert.equal(tracked, photo().links.download_location);
    const existing = photo("with-query");
    existing.links.download += "?ixid=abc&force=false";
    const queryLink = createPhotoCard(existing, { document }).querySelector(
        '[aria-label="Download photo from Unsplash"]',
    );
    assert.equal(new URL(queryLink.href).searchParams.get("ixid"), "abc");
    assert.deepEqual(new URL(queryLink.href).searchParams.getAll("force"), ["true"]);
});

test("photo cards use fallback alt text and treat API text as text", () => {
    const { document } = createDom();
    const value = photo("text", { alt_description: "", description: "" });
    value.user.name = '<img src=x onerror="alert(1)">';
    const card = createPhotoCard(value, { document });
    assert.equal(card.querySelector("img").alt, `Photograph by ${value.user.name}`);
    assert.equal(card.querySelector(".photographer span").textContent, value.user.name);
    assert.equal(card.querySelector("[onerror]"), null);
    value.description = "Description fallback";
    assert.equal(createPhotoCard(value, { document }).querySelector("img").alt, "Description fallback");
});

test("malformed or unsafe image URLs never become active image sources", () => {
    const { document } = createDom();
    const value = photo("unsafe", { urls: { small: "javascript:alert(1)", regular: "broken" } });
    value.user.profile_image.small = "http://example.com/image";
    const card = createPhotoCard(value, { document });
    assert.equal(card.querySelector("img").getAttribute("src"), "");
    assert.equal(card.querySelector("img").srcset, "");
    assert.equal(card.querySelectorAll("img")[1].getAttribute("src"), "");
});

test("status and skeleton rendering replace old content and attach configuration actions", () => {
    const { elements } = createDom();
    let actions = 0;
    renderStatus(elements.status, "<script>", "<img src=x>", {
        actionLabel: "Configure",
        onAction: () => {
            actions++;
        },
    });
    assert.equal(elements.status.querySelector("script"), null);
    assert.equal(elements.status.querySelector("h3").textContent, "<script>");
    elements.status.querySelector("button").click();
    assert.equal(actions, 1);
    renderStatus(elements.status, "Ready", "Search now");
    assert.equal(elements.status.querySelector("button"), null);
    renderSkeletons(elements.gallery);
    assert.equal(elements.gallery.querySelectorAll('[aria-hidden="true"]').length, 8);
    renderSkeletons(elements.gallery);
    assert.equal(elements.gallery.children.length, 8);
});

test("renderer handles loading, success, append retry, empty, and missing-key states", () => {
    const { elements } = createDom();
    let settings = 0;
    const render = createRenderer(elements, {
        onSettings: () => {
            settings++;
        },
        onDownload() {},
    });
    const state = {
        query: "sea",
        page: 0,
        totalPages: 2,
        total: 24,
        photos: [],
        loading: true,
        append: false,
        error: null,
    };
    render(state);
    assert.equal(elements.gallery.children.length, 8);
    assert.equal(elements.gallery.getAttribute("aria-busy"), "true");
    assert.equal(elements.loadMore.hidden, true);
    state.loading = false;
    state.page = 1;
    state.photos = [photo()];
    render(state);
    assert.equal(elements.gallery.querySelectorAll(".photo-card").length, 1);
    assert.equal(elements.resultsTitle.textContent, "24 results for “sea”");
    assert.equal(elements.loadMore.hidden, false);
    const firstCard = elements.gallery.firstChild;
    state.loading = true;
    state.append = true;
    render(state);
    assert.equal(elements.gallery.firstChild, firstCard);
    assert.equal(elements.loadMore.disabled, true);
    assert.equal(elements.loadMore.textContent.trim(), "Loading photos…");
    state.loading = false;
    state.error = { code: "network", message: "Offline" };
    render(state);
    assert.equal(elements.gallery.firstChild, firstCard);
    assert.equal(elements.loadMore.hidden, false);
    assert.equal(elements.loadMore.disabled, false);
    assert.match(elements.status.textContent, /Offline/);
    state.error = null;
    state.photos = [];
    state.page = 1;
    state.totalPages = 0;
    render(state);
    assert.match(elements.status.textContent, /No photos found/);
    assert.equal(elements.resultsTitle.textContent, "No matches this time");
    assert.equal(elements.loadMore.hidden, true);
    state.error = { code: "missing-key", message: "Add your key" };
    render(state);
    elements.status.querySelector("button").click();
    assert.equal(settings, 1);
    assert.equal(elements.resultsTitle.textContent, "Search unavailable");
});
