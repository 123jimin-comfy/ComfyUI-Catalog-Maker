//@ts-check

import { WORKFLOWS } from "./index.mjs";

/** @import {Client} from "@stable-canvas/comfyui-client" */
/** @import {ImageGenerationParams} from "./workflow/type" */

/**
 * 
 * @param {Client} client 
 * @param {ImageGenerationParams} params 
 */
export async function generate(client, params) {
    const workflowFunc = WORKFLOWS[params.workflow_id];
    if(!workflowFunc) throw new Error(`Unknown workflow_id: ${params.workflow_id}`);

    console.log("generate", params);

    const [workflow] = workflowFunc(params);
    const instance = workflow.instance(client, {
        resolver(acc, output, {client}) {
            if(output == null) return acc;

            const output_images = output['images'];
            if(output_images == null) return acc;

            const image_urls = output_images.map(({filename, subfolder, type}) => {
                if(filename == null || subfolder == null || type !== 'output') return null;
                return client.viewURL(filename, subfolder, type);
            }).filter((s) => s != null);

            if(image_urls.length === 0) return acc;
            return {...acc, images: image_urls.map((image_url) => ({
                type: 'url',
                data: image_url,
            }))};
        },
    });
    await instance.enqueue();
    
    console.log("Waiting...");

    const result = await instance.wait();

    console.log("Done!");
    console.log(result);
}