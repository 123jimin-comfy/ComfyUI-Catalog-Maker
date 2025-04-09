//@ts-check

export class PickSaver {
    /** @type {HTMLDivElement} */
    elem;

    /**
     * @param {HTMLDivElement} elem
     */
    constructor(elem) {
        this.elem = elem;
        elem.classList.add("pick-saver");
    }
}