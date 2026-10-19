import assert from "node:assert/strict";
import { test } from "node:test";
import { initializeSettings } from "../src/settings.js";
import { STORAGE } from "../src/config.js";
import { createDom } from "./dom.mjs";

const submit = (window, form, value) =>
    form.dispatchEvent(
        new window.SubmitEvent("submit", {
            cancelable: true,
            submitter:
                value === undefined
                    ? null
                    : Object.assign(window.document.createElement("button"), { value }),
        }),
    );

test("theme uses saved preference, toggles, and preserves the accessible control label", () => {
    const { window, elements } = createDom({ preferred: "light" });
    initializeSettings(elements, { window, onSave() {} });
    assert.equal(elements.document.dataset.theme, "light");
    elements.themeToggle.click();
    assert.equal(window.localStorage.getItem(STORAGE.theme), "dark");
    assert.equal(elements.themeToggle.getAttribute("aria-label"), "Switch to light theme");
    elements.themeToggle.click();
    assert.equal(elements.themeToggle.getAttribute("aria-label"), "Switch to dark theme");
    const other = createDom();
    other.window.localStorage.setItem(STORAGE.theme, "light");
    initializeSettings(other.elements, { window: other.window, onSave() {} });
    assert.equal(other.elements.document.dataset.theme, "light");
});

test("invalid stored theme falls back to system preference", () => {
    const { window, elements } = createDom();
    window.localStorage.setItem(STORAGE.theme, "purple");
    initializeSettings(elements, { window, onSave() {} });
    assert.equal(elements.document.dataset.theme, "dark");
});

test("settings reject blank keys, save valid keys, and clear back to the configured key", () => {
    const { window, elements, timers } = createDom();
    window.LUMA_CONFIG = { UNSPLASH_ACCESS_KEY: "configured" };
    let saves = 0;
    const settings = initializeSettings(elements, {
        window,
        onSave: () => {
            saves++;
        },
    });
    elements.settingsButton.click();
    settings.showSettings();
    assert.equal(elements.settingsDialog.open, true);
    assert.equal(elements.accessKey.value, "configured");
    elements.accessKey.value = " ";
    submit(window, elements.settingsForm, "save");
    assert.equal(elements.settingsDialog.open, true);
    assert.equal(saves, 0);
    assert.match(elements.toast.textContent, /Enter a valid/);
    elements.accessKey.value = " saved ";
    submit(window, elements.settingsForm, "save");
    assert.equal(settings.getKey(), "saved");
    assert.equal(window.localStorage.getItem(STORAGE.accessKey), "saved");
    assert.equal(elements.settingsDialog.open, false);
    assert.equal(saves, 1);
    assert.equal(elements.toast.classList.contains("visible"), true);
    timers.at(-1)();
    assert.equal(elements.toast.classList.contains("visible"), false);
    elements.clearKey.click();
    assert.equal(window.localStorage.getItem(STORAGE.accessKey), null);
    assert.equal(settings.getKey(), "configured");
    assert.equal(saves, 2);
});

test("dismiss controls and clicks inside the dialog do not save keys", () => {
    const { window, elements } = createDom();
    initializeSettings(elements, { window, onSave: () => assert.fail() });
    elements.settingsButton.click();
    elements.accessKey.click();
    assert.equal(elements.settingsDialog.open, true);
    assert.equal(submit(window, elements.settingsForm, "cancel"), true);
    assert.equal(submit(window, elements.settingsForm), true);
    elements.settingsDialog.click();
    assert.equal(elements.settingsDialog.open, false);
});

test("unavailable storage still allows temporary keys and theme changes", () => {
    const { window, elements } = createDom();
    Object.defineProperty(window, "localStorage", {
        get() {
            throw new Error("blocked");
        },
    });
    const settings = initializeSettings(elements, { window, onSave() {} });
    elements.themeToggle.click();
    assert.equal(elements.document.dataset.theme, "light");
    elements.accessKey.value = "temporary";
    submit(window, elements.settingsForm, "save");
    assert.equal(settings.getKey(), "temporary");
    assert.match(elements.toast.textContent, /for this tab/);
    elements.clearKey.click();
    assert.equal(settings.getKey(), "");
    assert.match(elements.toast.textContent, /could not be removed/);
});
