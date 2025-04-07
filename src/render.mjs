//@ts-check

/** @import {Config, PromptConfig} from "./config"; */
/** @import {ImageGenerationParams} from "./comfy-ui/workflow/type" */

import fs from "node:fs/promises";
import path from "node:path";

import { generate } from "./comfy-ui/index.mjs";
import { checkpointToDirNames, createParameters } from "./config.mjs";
import { createClient } from "./client.mjs";

/**
 * @param {Config} config 
 * @param {string} render_dir
 * @param {boolean} force
 */
export async function render(config, render_dir, force = false) {
    const {comfy: comfy_config, prompts: prompt_configs, parameters: parameter_configs} = config;
    if(!comfy_config) throw new Error("ComfyUI config must be provided!");
    if(!parameter_configs) throw new Error("Parameter config must be provided!");

    const client = createClient(comfy_config);

    /** @type {Map<string, Partial<PromptConfig>>} */
    const prompt_config_by_id = new Map();

    for(const prompt_config of (prompt_configs ?? [])) {
        prompt_config_by_id.set(prompt_config.id, prompt_config);
    }

    const models = await client.getSDModels();
    const global_random_seed = 0|Math.random()*(2**31);

    for(const checkpoint of models) {
        const checkpoint_dir_names = checkpointToDirNames(checkpoint);
        if(checkpoint_dir_names.length === 0) continue;

        const checkpoint_path = path.join(render_dir, ...checkpoint_dir_names);
        
        const params = createParameters(parameter_configs, checkpoint);
        if(!params.workflow || params.prompt_ids.length === 0) continue;

        await fs.mkdir(checkpoint_path, {recursive: true});

        for(const prompt_id of params.prompt_ids) {
            const prompt_config = prompt_config_by_id.get(prompt_id);
            if(!prompt_config?.prompt) continue;

            const prompt = prompt_config.prompt;

            /** @type {ImageGenerationParams} */
            const gen_params = {
                checkpoint,
                workflow_id: params.workflow,

                width: params.width, height: params.height,
                prompt: {
                    style: params.styles,
                    positive: prompt,
                    negative: "",
                    loras: [],
                },
                sampler: {
                    seed: params.seed > 0 ? params.seed : global_random_seed,
                    steps: 20,
                    cfg: 7.5,
                    sampler_name: "dpmpp_sde_gpu",
                    scheduler: "karras",
                    denoise: 1.0,
                },
            };

            const image_path = path.join(checkpoint_path, `${prompt_id}.png`);

            if(!force && await fileExists(image_path)) {
                console.log(`Skipping: ${checkpoint} - ${prompt_id}`);
                continue;
            }

            console.log(`Rendering: ${checkpoint} - ${prompt_id}`);
            const image = await generate(client, gen_params);
            await fs.writeFile(image_path, image);
        }
    }
}

/**
 * Check if a file exists.
 * @param {string} file_path 
 * @returns {Promise<boolean>}
 */
async function fileExists(file_path) {
    try {
        await fs.access(file_path);
        return true;
    } catch {
        return false;
    }
}