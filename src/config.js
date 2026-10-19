export const STORAGE = {
    accessKey: "luma-unsplash-access-key",
    theme: "luma-theme",
};

export function getStorage(window) {
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

export function readStored(storage, key) {
    try {
        return storage?.getItem(key) || "";
    } catch {
        return "";
    }
}

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

export function getAccessKey(config = {}, storage = null) {
    const configured = config?.UNSPLASH_ACCESS_KEY;
    return (
        (typeof configured === "string" ? configured.trim() : "") ||
        readStored(storage, STORAGE.accessKey).trim()
    );
}
