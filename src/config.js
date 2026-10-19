export const STORAGE = {
    accessKey: "luma-unsplash-access-key",
    theme: "luma-theme",
};

/** @param {Pick<Window, "localStorage">} window */
export function getStorage(window) {
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

/** @param {Pick<Storage, "getItem"> | null} storage @param {string} key */
export function readStored(storage, key) {
    try {
        return storage?.getItem(key) || "";
    } catch {
        return "";
    }
}

/** @param {Pick<Storage, "setItem" | "removeItem"> | null} storage @param {string} key @param {string} value */
export function writeStored(storage, key, value) {
    try {
        if (!storage) return false;
        if (value) storage.setItem(key, value);
        else storage.removeItem(key);
        return true;
    } catch {
        return false;
    }
}

/** @param {import("./types.js").LumaConfig | null} [config] @param {Pick<Storage, "getItem"> | null} [storage] */
export function getAccessKey(config = {}, storage = null) {
    const configured = config?.UNSPLASH_ACCESS_KEY;
    return (
        (typeof configured === "string" ? configured.trim() : "") ||
        readStored(storage, STORAGE.accessKey).trim()
    );
}
