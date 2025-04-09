//@ts-check

/** @import {CatalogMetadata} from "../catalog" */

export class AxisPicker {
    /** @type {HTMLDivElement} */
    elem;

    /** @type {number[]} */
    #current_indices = [];

    get current_indices() {
        return this.#current_indices;
    }

    /** @type {boolean[]} */
    #enable_selects = [];

    /** @type {HTMLSelectElement[]} */
    #selects = [];

    /** @type {(indices: number[]) => void} */
    onChange = (() => {});

    /**
     * @param {HTMLDivElement} elem 
     */
    constructor(elem) {
        this.elem = elem;
        elem.classList.add("axis-picker");
    }

    /**
     * @param {CatalogMetadata} metadata 
     */
    handleLoad(metadata) {
        const select_container = document.createElement("div");
        select_container.classList.add("select-container");

        this.#enable_selects = metadata.axes.map((axis, i) => i < metadata.axes.length - 1 && axis.values.length > 1);
        if(metadata.axes.length === 1) this.#enable_selects[0] = true;

        /** @type {number[]} */
        this.#current_indices = metadata.axes.map((_, i) => this.#enable_selects[i] ? 0 : -1);
        this.#selects = [];

        for(let i = 0; i < metadata.axes.length; i++) {
            if(!this.#enable_selects[i]) continue;

            const axis = metadata.axes[i];

            const elem_select = document.createElement("select");
            elem_select.classList.add("axis-select");

            // Collect by option groups.
            /** @type {Array<{group: string, options: HTMLOptionElement[]}>} */
            const options_list = [];

            /** @type {Map<string, number>} */
            const option_group_indices = new Map();

            for(let j = 0; j < axis.values.length; j++) {
                const value = axis.values[j];
                const option_group_name = value.group ?? "";

                let option_group_index = option_group_indices.get(option_group_name);
                if(option_group_index == null) {
                    option_group_index = options_list.length;
                    option_group_indices.set(option_group_name, option_group_index);

                    options_list.push({
                        group: option_group_name,
                        options: []
                    });
                }

                const elem_option = document.createElement("option");
                elem_option.value = j.toString();
                elem_option.textContent = value.id;
                options_list[option_group_index].options.push(elem_option);
            }

            if(options_list.length === 1) {
                elem_select.append(...options_list[0].options);
            } else {
                elem_select.append(...options_list.map((option_group) => {
                    const elem_optgroup = document.createElement("optgroup");
                    elem_optgroup.label = option_group.group;
                    elem_optgroup.append(...option_group.options);
                    return elem_optgroup;
                }));
            }

            elem_select.onchange = () => {
                this.#current_indices[i] = parseInt(elem_select.value);
                this.onChange(this.#current_indices.slice());
            };

            this.#selects.push(elem_select);

            const elem_label = document.createElement("label");
            elem_label.textContent = `${axis.name}: `;
            elem_label.appendChild(elem_select);

            select_container.appendChild(elem_label);
        }

        this.elem.replaceChildren(select_container);
        this.onChange(this.#current_indices.slice());
    }

    /**
     * @param {number[]} indices 
     */
    setCurrentIndices(indices) {
        if(indices.length !== this.#enable_selects.length) {
            throw new Error("Invalid index length");
        }

        if(!indices.every((index, i) => (index >= 0) === this.#enable_selects[i])) {
            throw new Error("Invalid indices");
        }

        this.#current_indices = indices.slice();
        for(let i = 0; i < this.#enable_selects.length; i++) {
            if(this.#enable_selects[i]) {
                this.#selects[i].value = indices[i].toString();
            }
        }
    }
}