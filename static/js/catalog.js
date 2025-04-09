//@ts-check

/** @import {CatalogMetadata} from "./catalog" */

import {advanceIndices, getImagePath} from "./util.js";

/**
 * @param {CatalogMetadata} metadata
 * @param {number[]} fixed_indices
 * @returns {Generator<number[]>}
 */
function* enumerateAxisIndices(metadata, fixed_indices) {
    if(!fixed_indices.includes(-1)) {
        yield fixed_indices.slice();
        return;
    }

    const variable_indices = fixed_indices.map((v, i) => v === -1 ? i : -1).filter(v => v !== -1);
    const variable_lens = variable_indices.map(i => metadata.axes[i].values.length);
    const variable_axis_indices = variable_lens.map(() => 0);

    do {
        const indices = fixed_indices.slice();
        for(let i = 0; i < variable_indices.length; i++) {
            indices[variable_indices[i]] = variable_axis_indices[i];
        }

        yield indices;
    } while(advanceIndices(variable_lens, variable_axis_indices));
}

/**
 * @param {CatalogMetadata} metadata 
 * @param {number[]} indices
 * @returns {string|null}
 */
function getCheckpoint(metadata, indices) {
    /** @type {string|null} */
    let checkpoint = metadata.checkpoint;

    for(let i = 0; i < indices.length; i++) {
        if(metadata.axes[i].target === "checkpoint") {
            checkpoint = /** @type {string} */ (metadata.axes[i].values[indices[i]].value);
        }
    }

    return checkpoint;
}

export class Catalog {
    /** @type {HTMLDivElement} */
    elem;

    /** @type {HTMLDivElement} */
    elem_grid;

    base_path = "";

    /** @type {CatalogMetadata} */
    metadata;

    /**
     * @param {HTMLDivElement} elem 
     */
    constructor(elem) {
        this.elem = elem;

        const elem_grid = document.createElement("div");
        elem_grid.classList.add("catalog-grid");

        this.elem_grid = elem_grid;
        this.elem.appendChild(elem_grid);
    }

    /**
     * @param {string} base_path 
     * @param {CatalogMetadata} metadata 
     */
    #setMetadata(base_path, metadata) {
        this.base_path = base_path;
        this.metadata = metadata;
    }

    /**
     * @param {string} catalog_path 
     */
    async load(catalog_path) {
        console.log("Test: loading", catalog_path);

        /** @type {CatalogMetadata} */
        const metadata = await(await fetch(`${catalog_path}/metadata.json`)).json();

        this.#setMetadata(catalog_path, metadata);

        console.log("Test: loaded metadata", metadata);

        this.show(metadata.axes.map(() => -1));
    }

    /**
     * Show the images at the given indices.
     * If an index is -1, then all images for that axis are shown.
     * 
     * @param {number[]} fixed_indices 
     */
    show(fixed_indices) {
        if(!this.metadata) {
            throw new Error("Metadata not loaded!");
        }

        /** @type {HTMLImageElement[]} */
        const images = [];

        for(const indices of enumerateAxisIndices(this.metadata, fixed_indices)) {
            const axis_ids = indices.map((i, axis) => this.metadata.axes[axis].values[i].id);
            const checkpoint = getCheckpoint(this.metadata, indices);
            if(!checkpoint) continue;

            const path = getImagePath(axis_ids, checkpoint);
            const src = `${this.base_path}/${path.join('/')}.png`;
            
            const img = document.createElement('img');
            img.src = src;
            images.push(img);
        }

        this.elem_grid.replaceChildren(...images);
    }
}