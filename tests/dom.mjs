import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { getElements } from "../src/dom.js";

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
    const elements = getElements(window.document);
    elements.settingsDialog.showModal = () => {
        elements.settingsDialog.open = true;
    };
    elements.settingsDialog.close = () => {
        elements.settingsDialog.open = false;
    };
    return { dom, window, document: window.document, elements, timers };
}
