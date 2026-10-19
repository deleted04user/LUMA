import { fetchPhotos, trackDownload } from "../../src/api.js";
import { createPhotoCard } from "../../src/render.js";

async function verifyCallerContracts() {
    const result = await fetchPhotos("sea", { page: 2 });
    if (result.ok) {
        result.data.results.forEach((photo) => createPhotoCard(photo));
        // @ts-expect-error Success results do not expose a failure message.
        result.error.message;
    } else {
        result.error.message.toUpperCase();
        // @ts-expect-error Failures do not expose photo data.
        result.data.results;
    }
    // @ts-expect-error Page numbers must be numeric.
    await fetchPhotos("sea", { page: "two" });
    // @ts-expect-error Download tracking requires a URL string.
    await trackDownload(42);
}

// This file is checked with --noEmit; it never runs or contacts Unsplash.
void verifyCallerContracts;
