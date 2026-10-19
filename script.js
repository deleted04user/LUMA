import { fetchPhotos, trackDownload } from "./src/api.js";
import { createRenderer, renderStatus } from "./src/render.js";
import { createSearchController, normalizeQuery } from "./src/search.js";
import { initializeSettings } from "./src/settings.js";
import { getElements } from "./src/dom.js";

const elements = getElements(document);

const settings = initializeSettings(elements, {
    onSave: () => {
        if (search.getState().query) search.refresh();
        else showConfigurationStatus();
    },
});
const render = createRenderer(elements, {
    onSettings: settings.showSettings,
    onDownload: async (url) => {
        const result = await trackDownload(url, { accessKey: settings.getKey() });
        if (!result.ok)
            settings.showToast("Download tracking failed. You can still open the photo on Unsplash.");
    },
});
const search = createSearchController({
    fetchPhotos: (query, options) => fetchPhotos(query, { ...options, accessKey: settings.getKey() }),
    onChange: render,
});

function showConfigurationStatus() {
    if (!settings.getKey()) {
        renderStatus(
            elements.status,
            "Connect Unsplash to search",
            "Add your free Unsplash Access Key once to enable live results.",
            {
                actionLabel: "Add Access Key",
                onAction: settings.showSettings,
            },
        );
    } else {
        renderStatus(
            elements.status,
            "Start with an idea",
            "Search by subject, place, color, mood, or anything you can imagine.",
        );
    }
}

/** @param {string} query */
function startSearch(query) {
    const cleaned = normalizeQuery(query);
    if (!cleaned) {
        elements.input.focus();
        settings.showToast("Enter something to search for.");
        return;
    }
    elements.input.value = cleaned;
    search.search(cleaned);
}

elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    startSearch(elements.input.value);
});
document.querySelectorAll("button[data-query]").forEach((button) => {
    button.addEventListener("click", () => startSearch(button.getAttribute("data-query") || ""));
});
elements.loadMore.addEventListener("click", () => search.loadMore());
elements.orientation.addEventListener("change", () =>
    search.refresh({ orientation: elements.orientation.value }),
);
elements.sort.addEventListener("change", () => search.refresh({ orderBy: elements.sort.value }));
showConfigurationStatus();
