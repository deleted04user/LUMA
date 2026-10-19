import assert from "node:assert/strict";
import { test } from "node:test";
import { getElements } from "../src/dom.js";
import { createDom } from "./dom.mjs";

test("the real interface provides correctly typed controls for the entry script", () => {
    const { document, window } = createDom();
    const elements = getElements(document);
    assert.ok(elements.input instanceof window.HTMLInputElement);
    assert.ok(elements.settingsDialog instanceof window.HTMLDialogElement);
    assert.ok(elements.loadMoreLabel instanceof window.HTMLSpanElement);
});

test("missing, incorrect, or detached interface elements fail with an actionable error", () => {
    const { document } = createDom();
    document.getElementById("search-box").remove();
    assert.throws(() => getElements(document), /missing or invalid: search-box/);
    const wrongType = document.createElement("div");
    wrongType.id = "search-box";
    document.body.append(wrongType);
    assert.throws(() => getElements(document), /missing or invalid: search-box/);
    assert.throws(
        () => getElements(document.implementation.createHTMLDocument()),
        /requires a browser document/,
    );
});
