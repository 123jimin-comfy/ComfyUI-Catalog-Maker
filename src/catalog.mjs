//@ts-check

/** @import {BackendConfig} from "./config/backend" */
/** @import {CatalogConfig, CatalogAxisConfig, AxisValue} from "./config/catalog" */
/** @import {ParameterConfig} from "./config/parameter" */

/** @import {ImageGenerationParams} from "./comfy-ui/workflow/type" */

/** @import {ProgramArgs} from "./bin/type" */

import fs from "node:fs/promises";
import path from "node:path";

import { createClient, generate, Client } from "./comfy-ui/index.mjs";
import { createParameters, getCatalogAxisValues } from "./config/index.mjs";
import { fileExists, toFileName } from "./util.mjs";

/**
 * Generates the catalog, and saves the rendered images and metadata to the output path.
 * 
 * @param {BackendConfig} backend_config 
 * @param {CatalogConfig} catalog_config 
 * @param {Pick<ProgramArgs, 'reset' | 'force' | 'output_dir' | 'gen_info'>} args 
 */
export async function generateCatalog(backend_config, catalog_config, args) {
    if(!backend_config.comfy) throw new Error(`Backend config must include configs for the ComfyUI backend!`);

    if(args.reset) {
        console.warn(`Resetting output directory: ${args.output_dir}`);
        await fs.rm(args.output_dir, { recursive: true, force: true });
    }

    const client = createClient(backend_config.comfy);

    /** @type {AxisValue[][]} */
    const axis_values_list = [];

    const global_random_seed = 0|Math.random()*(2**31);

    for await (const [indices, params] of enumerateImageGeneration(client, backend_config, catalog_config, axis_values_list)) {
        if(!params.checkpoint) continue;
        if(!params.workflow) continue;

        const axis_value_ids = axis_values_list
            .map((axis_values, i) => axis_values[indices[i]])
            .filter((_, i) => catalog_config.axes[i].target !== 'checkpoint')
            .map((axis_value) => axis_value.id);

        /** @type {ImageGenerationParams} */
        const gen_params = {
            workflow_id: params.workflow,
            checkpoint: params.checkpoint,

            width: params.width, height: params.height,
            prompt: {
                style: params.styles ?? [],
                positive: params.prompt,
                negative: "",
                loras: [],
            },
            sampler: {
                seed: (params.seed && params.seed > 0) ? params.seed : global_random_seed,
                steps: params.steps,
                cfg: params.cfg,
                sampler_name: params.sampler_name,
                scheduler: params.scheduler,
                denoise: params.denoise,
            },
        };

        const output_file_path = path.join(args.output_dir, ...getImagePath(axis_value_ids, gen_params));
        const output_image_path = output_file_path + '.png';
        const output_json_path = output_file_path + '.json';

        // Creates the parent directory recursively.
        await fs.mkdir(path.dirname(output_file_path), { recursive: true });

        if(!args.force && await fileExists(output_image_path)) {
            console.log(`Skipping: ${output_image_path}`);
            continue;
        }

        console.log(`Rendering: ${output_image_path}`);

        const image = await generate(client, gen_params);
        await fs.writeFile(output_image_path, image);

        if(args.gen_info) {
            await fs.writeFile(output_json_path, JSON.stringify(gen_params, null, 4), 'utf-8');
        }
    }
}

/**
 * Enumerates all possible image generation parameters for the given backend and catalog configs.
 * 
 * @param {Client} client
 * @param {BackendConfig} backend_config
 * @param {CatalogConfig} catalog_config
 * @param {AxisValue[][]} [out_axis_values_list] If provided, the axis values will be written to this array.
 * @returns {AsyncGenerator<[indices: number[], params: ParameterConfig]>}
 */
async function* enumerateImageGeneration(client, backend_config, catalog_config, out_axis_values_list) {
    const axes = catalog_config.axes;

    const axis_indices = axes.map(() => 0);
    const axis_values_list = await Promise.all(axes.map(axis => getCatalogAxisValues(client, axis)));

    if(out_axis_values_list) {
        out_axis_values_list.splice(0, out_axis_values_list.length, ...axis_values_list);
    }

    if(axes.length === 0) return;
    if(axis_values_list.some(values => values.length === 0)) return;

    /** @type {string | null} */
    let default_checkpoint = null;
    for(const parameters of (catalog_config.parameters ?? [])) {
        if(!parameters.pattern && parameters.checkpoint) {
            default_checkpoint = parameters.checkpoint;
            break;
        }
    }

    do {
        const axis_values = axis_indices.map((index, i) => axis_values_list[i][index]);

        // Determine the checkpoint to be used.
        let checkpoint = default_checkpoint ?? "";

        for(let i=0; i<axes.length; ++i) {
            if(axes[i].target === "checkpoint") {
                checkpoint = `${axis_values[i]}`;
            }
        }

        const params = createParameters(checkpoint,
            ...(backend_config.parameters ?? []),
            ...(catalog_config.parameters ?? []),
        );

        for(let i=0; i<axes.length; ++i) {
            const axis = axes[i];
            const value = axis_values[i];

            if(axis.target === "checkpoint") {
                continue;
            }
            
            if(!Object.hasOwn(params, axis.target)) {
                throw new Error(`Unknown parameter: ${axis.target}`);
            }

            params[axis.target] = value;
        }

        yield [
            axis_indices.slice(),
            params,
        ];
    } while(advanceAxisIndices(axis_indices, axis_values_list));
}

/**
 * @param {number[]} axis_indices 
 * @param {Array<unknown[]>} axis_values_list
 * @returns {boolean} If the axis indices were advanced. If false, the axis indices are at the end.
 */
function advanceAxisIndices(axis_indices, axis_values_list) {
    for(let i = axis_indices.length - 1; i >= 0; i--) {
        axis_indices[i]++;
        if(axis_indices[i] < axis_values_list[i].length) {
            return true;
        } else {
            axis_indices[i] = 0;
        }
    }

    return false;
}

/**
 * Returns the path to the image file for the given checkpoint and generation parameters.
 * 
 * @param {string[]} axis_value_ids 
 * @param {ImageGenerationParams} gen_params
 * @return {string[]} The path to the image file.
 */
function getImagePath(axis_value_ids, gen_params) {
    const checkpoint_dir = toFileName(gen_params.checkpoint);

    return [
        checkpoint_dir,
        axis_value_ids.length === 0 ? 'image' : axis_value_ids.join('_'),
    ];
}
