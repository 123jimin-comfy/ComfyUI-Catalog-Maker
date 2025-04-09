//@ts-check

import { Catalog } from "./catalog.js";
const catalog = new Catalog(
    /** @type {HTMLDivElement} */ (document.getElementById("catalog"))
);

// For testing!
document.getElementById("btn-load-catalog")?.addEventListener("click", () => {
    const catalog_path = (/** @type {HTMLInputElement} */ (document.getElementById("catalog-path"))).value;

    catalog.load(`data/${catalog_path}`).catch((err) => {
        console.error("Failed to load catalog!");
        console.error(err);
    });
});
