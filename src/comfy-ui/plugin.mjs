import {Plugin} from "@stable-canvas/comfyui-client";

/**
 * Provide HTTP basic authentication support.
 */
export class BasicAuthPlugin extends Plugin {
    /** @type {string} */
    #username;

    /** @type {string} */
    #password;

    /**
     * @param {string} username 
     * @param {string} password 
     */
    constructor(username, password = "") {
        super();

        this.#username = username;
        this.#password = password;

        // eslint-disable-next-line consistent-this, @typescript-eslint/no-this-alias
        const plugin = this;

        this.addHook({
            type: 'function',
            name: "wsURL",
            fn: function (original) {
                const url = new URL(original());
                url.username = plugin.#username;
                url.password = plugin.#password;

                return url.toString();
            },
        });

        this.addHook({
            type: 'function',
            name: "apiHeaders",
            fn: function (original, options) {
                const headers = new Headers(original(options));
                headers.set("Authorization", `Basic ${btoa(`${plugin.#username}:${plugin.#password}`)}`);

                return headers;
            },
        });
    }
}