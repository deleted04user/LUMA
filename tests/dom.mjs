import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

export function createDom({ preferred = "dark" } = {}) {
    const dom = new JSDOM(html, { url: "http://localhost:8000/" });
    const { window } = dom;
    window.matchMedia = () => ({ matches: preferred === "light" });
    const timers = [];
    window.setTimeout = (callback) => {
        timers.push(callback);
        return timers.length;
    };
    window.clearTimeout = () => {};
    const elements = { document: window.document.documentElement };
    for (const [name, id] of Object.entries({
        gallery: "search-result",
        status: "status-panel",
        loadMore: "show-more-btn",
        resultsTitle: "results-title",
        filters: "filters",
        themeToggle: "theme-toggle",
        settingsButton: "settings-button",
        settingsDialog: "settings-dialog",
        settingsForm: "settings-form",
        accessKey: "access-key",
        clearKey: "clear-key",
        toast: "toast",
    }))
        elements[name] = window.document.getElementById(id);
    elements.settingsDialog.showModal = () => {
        elements.settingsDialog.open = true;
    };
    elements.settingsDialog.close = () => {
        elements.settingsDialog.open = false;
    };
    return { dom, window, document: window.document, elements, timers };
}
