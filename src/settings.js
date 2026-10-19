import { getAccessKey, getStorage, readStored, writeStored, STORAGE } from "./config.js";

export function initializeSettings(elements, { window = globalThis.window, onSave }) {
    const storage = getStorage(window);
    let sessionKey;
    let toastTimer;
    const getKey = () => sessionKey ?? getAccessKey(window.LUMA_CONFIG, storage);
    const showToast = (message) => {
        window.clearTimeout(toastTimer);
        elements.toast.textContent = message;
        elements.toast.classList.add("visible");
        toastTimer = window.setTimeout(() => elements.toast.classList.remove("visible"), 3200);
    };
    const showSettings = () => {
        elements.accessKey.value = getKey();
        if (!elements.settingsDialog.open) elements.settingsDialog.showModal();
        elements.accessKey.focus();
    };
    const setTheme = (theme) => {
        const next = theme === "light" ? "light" : "dark";
        elements.document.dataset.theme = next;
        writeStored(storage, STORAGE.theme, next);
        elements.themeToggle.setAttribute(
            "aria-label",
            next === "dark" ? "Switch to light theme" : "Switch to dark theme",
        );
    };
    const preferred = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    const saved = readStored(storage, STORAGE.theme);
    setTheme(["light", "dark"].includes(saved) ? saved : preferred);
    elements.themeToggle.addEventListener("click", () =>
        setTheme(elements.document.dataset.theme === "dark" ? "light" : "dark"),
    );
    elements.settingsButton.addEventListener("click", showSettings);
    elements.settingsDialog.querySelector(".dialog-close").addEventListener("click", () => {
        elements.settingsDialog.close();
    });
    elements.settingsForm.addEventListener("submit", (event) => {
        if (event.submitter?.value !== "save") return;
        event.preventDefault();
        const key = elements.accessKey.value.trim();
        if (!key) {
            showToast("Enter a valid Unsplash Access Key.");
            elements.accessKey.focus();
            return;
        }
        sessionKey = key;
        const persisted = writeStored(storage, STORAGE.accessKey, key);
        elements.settingsDialog.close();
        showToast(
            persisted
                ? "Access Key saved. Search to connect to Unsplash."
                : "Access Key available for this tab. Browser storage is unavailable.",
        );
        onSave();
    });
    elements.clearKey.addEventListener("click", () => {
        sessionKey = undefined;
        const removed = writeStored(storage, STORAGE.accessKey, "");
        elements.accessKey.value = getKey();
        showToast(
            removed
                ? "Saved Access Key removed. Local config still applies if present."
                : "Browser storage is unavailable; the saved key could not be removed.",
        );
        onSave();
    });
    elements.settingsDialog.addEventListener("click", (event) => {
        if (event.target === elements.settingsDialog) elements.settingsDialog.close();
    });
    return { getKey, showToast, showSettings };
}
