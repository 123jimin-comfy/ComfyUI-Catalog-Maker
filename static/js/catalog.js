//@ts-check

export class Catalog {
    /** @type {HTMLDivElement} */
    elem;

    /**
     * @param {HTMLDivElement} elem 
     */
    constructor(elem) {
        this.elem = elem;
    }

    /**
     * @param {string} catalog_path 
     */
    async load(catalog_path) {
        console.log("Test: loading", catalog_path);
    }
}