/**
 * @template {HTMLElement} T
 * @param {Document} document
 * @param {string} id
 * @param {new () => T} ElementType
 * @returns {T}
 */
function requireElement(document, id, ElementType) {
    const element = document.getElementById(id);
    if (!(element instanceof ElementType))
        throw new Error(`Required interface element is missing or invalid: ${id}`);
    return element;
}

/** @param {Document} document */
export function getElements(document) {
    const view = document.defaultView;
    if (!view) throw new Error("Luma requires a browser document.");
    return {
        document: document.documentElement,
        form: requireElement(document, "search-form", view.HTMLFormElement),
        input: requireElement(document, "search-box", view.HTMLInputElement),
        gallery: requireElement(document, "search-result", view.HTMLDivElement),
        status: requireElement(document, "status-panel", view.HTMLDivElement),
        resultsTitle: requireElement(document, "results-title", view.HTMLHeadingElement),
        filters: requireElement(document, "filters", view.HTMLDivElement),
        orientation: requireElement(document, "orientation-filter", view.HTMLSelectElement),
        sort: requireElement(document, "sort-filter", view.HTMLSelectElement),
        loadMore: requireElement(document, "show-more-btn", view.HTMLButtonElement),
        loadMoreLabel: requireElement(document, "load-more-label", view.HTMLSpanElement),
        themeToggle: requireElement(document, "theme-toggle", view.HTMLButtonElement),
        settingsButton: requireElement(document, "settings-button", view.HTMLButtonElement),
        settingsDialog: requireElement(document, "settings-dialog", view.HTMLDialogElement),
        settingsForm: requireElement(document, "settings-form", view.HTMLFormElement),
        closeSettings: requireElement(document, "settings-close", view.HTMLButtonElement),
        accessKey: requireElement(document, "access-key", view.HTMLInputElement),
        clearKey: requireElement(document, "clear-key", view.HTMLButtonElement),
        toast: requireElement(document, "toast", view.HTMLDivElement),
    };
}
