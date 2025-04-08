//@ts-check

import { Catalog } from "./catalog.js";
const catalog = new Catalog(
    /** @type {HTMLDivElement} */ (document.getElementById("catalog"))
);

// This is for testing.
document.getElementById("btn-load-catalog")?.addEventListener("click", () => {
    const catalog_path = (/** @type {HTMLInputElement} */ (document.getElementById("catalog-path"))).value;

    catalog.load(catalog_path).catch((err) => {
        console.error("Failed to load catalog!");
        console.error(err);
    });
});
