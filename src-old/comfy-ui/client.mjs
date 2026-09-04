//@ts-check

/** @import {ComfyUIConfig} from "../config/backend" */

export { Client } from "@stable-canvas/comfyui-client";
import { Client } from "@stable-canvas/comfyui-client";
import { WebSocket as WS } from "ws";
import { BasicAuthPlugin} from "./index.mjs";
import { parseComfyApiUrl } from "@jiminp/comfy-box";

/**
 * @param {ComfyUIConfig} config 
 * @return {Client}
 */
export function createClient(config) {
    const client = new Client({
        ...parseComfyApiUrl(config.url),
        WebSocket: WS,
    });

    if(config.auth?.password) {
        client.use(new BasicAuthPlugin(config.auth.username, config.auth.password));
    }

    client.on('connection_error', (err) => {
        console.error(err);
    });

    client.connect();

    return client;
}