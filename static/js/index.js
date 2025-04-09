//@ts-check

import { Catalog } from "./ui/catalog.js";
const catalog = new Catalog(
    /** @type {HTMLDivElement} */ (document.getElementById("catalog"))
);

/** @param {string} catalog_path */
const loadCatalog = async(catalog_path) => {
    try {
        await catalog.load(`data/${catalog_path}`);
    } catch (err) {
        console.error("Failed to load catalog!");
        console.error(err);
    }
};

fetch("./data/index.json").then(async (res) => {
    /** @type {string[]} */
    const catalog_list = await res.json();
    
    const elem_select_catalog = /** @type {HTMLSelectElement} */ (document.getElementById("select-catalog"));
    elem_select_catalog.replaceChildren(...catalog_list.map((name) => {
        const elem_option = document.createElement("option");
        elem_option.value = name;
        elem_option.textContent = name;
        return elem_option;
    }));

    elem_select_catalog.addEventListener("change", () => {
        loadCatalog(elem_select_catalog.value);
    });

    loadCatalog(catalog_list[0]);
}).catch((err) => {
    console.error("Failed to load catalog list!");
    console.error(err);
});
