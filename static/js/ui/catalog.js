//@ts-check

/** @import {CatalogMetadata} from "../catalog" */

import { AxisPicker } from "./axis-picker.js";
import { CatalogGrid } from "./catalog-grid.js";
import { PickSaver } from "./pick-saver.js";

import {advanceIndices, getImagePath} from "../util.js";

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

    /** @type {AxisPicker} */
    axis_picker;

    /** @type {PickSaver} */
    pick_saver;

    /** @type {CatalogGrid} */
    grid;
    
    /** @type {string} */
    base_path = "";

    /** @type {CatalogMetadata} */
    metadata;

    /**
     * @param {HTMLDivElement} elem 
     */
    constructor(elem) {
        this.elem = elem;
        elem.classList.add("catalog");

        this.axis_picker = new AxisPicker(document.createElement("div"));
        this.axis_picker.onChange = (indices) => this.show(indices);
        this.elem.appendChild(this.axis_picker.elem);

        this.pick_saver = new PickSaver(document.createElement("div"));
        this.elem.appendChild(this.pick_saver.elem);

        this.grid = new CatalogGrid(document.createElement("div"));
        this.elem.appendChild(this.grid.elem);
    }

    /**
     * @param {string} base_path 
     * @param {CatalogMetadata} metadata 
     */
    #setMetadata(base_path, metadata) {
        this.base_path = base_path;
        this.metadata = metadata;

        this.grid.reset();
        this.axis_picker.handleLoad(metadata);
    }

    /**
     * @param {string} catalog_path 
     */
    async load(catalog_path) {
        /** @type {CatalogMetadata} */
        const metadata = await(await fetch(`${catalog_path}/metadata.json`)).json();

        this.#setMetadata(catalog_path, metadata);
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

        /** @type {string[]} */
        const image_srcs = [];
        
        for(const indices of enumerateAxisIndices(this.metadata, fixed_indices)) {
            const image_src = this.#getImageSrc(indices);
            if(image_src) image_srcs.push(image_src);
        }

        this.grid.showImages(image_srcs);
    }

    /**
     * @param {number[]} indices 
     * @returns {string|null}
     */
    #getImageSrc(indices) {
        const axis_ids = indices.map((i, axis) => this.metadata.axes[axis].values[i].id);

        const checkpoint = getCheckpoint(this.metadata, indices);
        if(!checkpoint) return null;

        const path = getImagePath(axis_ids, checkpoint);
        const src = `${this.base_path}/${path.join('/')}.png`;

        return src;
    }
}