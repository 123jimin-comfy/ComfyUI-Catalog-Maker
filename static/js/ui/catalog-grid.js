//@ts-check

// TODO: support 2D grid
export class CatalogGrid {
    /** @type {HTMLDivElement} */
    elem;

    /** @type {HTMLImageElement[]} */
    elem_images = [];

    /**
     * @param {HTMLDivElement} elem 
     */
    constructor(elem) {
        this.elem = elem;
        elem.classList.add("catalog-grid");
    }

    // Removes all images from the grid.
    reset() {
        this.elem_images = [];
        this.elem.replaceChildren();
    }

    /**
     * @param {string[]} image_srcs 
     */
    showImages(image_srcs) {
        while(this.elem_images.length < image_srcs.length) {
            const elem_img = document.createElement("img");
            elem_img.loading = 'lazy';
            elem_img.decoding = 'async';

            elem_img.addEventListener("load", () => {
                elem_img.classList.remove("image-loading");
                elem_img.classList.remove("image-error");
            });

            elem_img.addEventListener("error", () => {
                elem_img.classList.remove("image-loading");
                elem_img.classList.add("image-error");
            });

            elem_img.addEventListener("click", () => {
                window.open(elem_img.src, "_blank");
            });

            this.elem_images.push(elem_img);
            this.elem.appendChild(elem_img);
        }

        while(this.elem_images.length > image_srcs.length) {
            const elem_image = this.elem_images.pop();
            elem_image?.remove();
        }

        for(let i = 0; i < image_srcs.length; i++) {
            const elem_image = this.elem_images[i];
            const image_src = image_srcs[i];

            if(elem_image.src === image_src) continue;

            elem_image.classList.add("image-loading");
            elem_image.classList.remove("image-error");
            
            elem_image.src = image_src;
        }
    }
}