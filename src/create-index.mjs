//@ts-check

/** @import {Config, PromptConfig} from "./config"; */
/** @import {Catalog, CatalogCheckpoint} from "./catalog"; */

import fs from "node:fs/promises";

import { createClient } from "./client.mjs";
import { checkpointToDirNames, createParameters } from "./config.mjs";

/**
 * @param {Config} config
 * @param {string} out_path
 */
export async function createIndex(config, out_path) {
    const {comfy: comfy_config, prompts: prompt_configs, parameters: parameter_configs} = config;
    if(!comfy_config) throw new Error("ComfyUI config must be provided!");
    if(!parameter_configs) throw new Error("Parameter config must be provided!");

    const client = createClient(comfy_config);
    const models = await client.getSDModels();

    /** @type {Catalog} */
    const catalog = {
        checkpoints: [],
        prompts: (prompt_configs ?? []),
    };
    
    for(const checkpoint of models) {
        const checkpoint_dir_names = checkpointToDirNames(checkpoint);
        if(checkpoint_dir_names.length === 0) continue;

        const params = createParameters(parameter_configs, checkpoint);
        if(!params.workflow || params.prompt_ids.length === 0) continue;
        
        /** @type {CatalogCheckpoint} */
        const catalog_checkpoint = {
            checkpoint,
            dir_names: checkpoint_dir_names,
            prompts: params.prompt_ids,
        };

        catalog.checkpoints.push(catalog_checkpoint);
    }

    await fs.writeFile(out_path, JSON.stringify(catalog, null, 4), "utf-8");
}