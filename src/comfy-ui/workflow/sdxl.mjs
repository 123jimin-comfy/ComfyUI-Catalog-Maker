//@ts-check

/** @import {NodeOutput} from "@stable-canvas/comfyui-client" */
/** @import {ImageGenerationParams, WorkflowInfo} from "./type" */

import { Workflow } from "@stable-canvas/comfyui-client";
import { addCheckpointExtension } from "./common.mjs";

/**
 * @param {ImageGenerationParams} params 
 * @returns {[Workflow, WorkflowInfo]}
 */
export function createSDXLWorkflow(params) {
    const workflow = new Workflow();
    const {
        "Load Styles CSV": LoadStylesCSV,
        ApplyStyleStrings,

        "Eff. Loader SDXL": EfficientLoaderSDXL,
        "KSampler SDXL (Eff.)": EfficientKSamplerSDXL,

        SaveImage,
    } = workflow.classes;

    /** @type {NodeOutput|string} */
    let prompt_positive = params.prompt.positive;
    
    /** @type {NodeOutput|string} */
    let prompt_negative = params.prompt.negative;

    for(const style of params.prompt.style) {
        const [style_positive, style_negative] = LoadStylesCSV({
            styles: style,
        });

        [prompt_positive, prompt_negative] = ApplyStyleStrings({
            prompt_positive,
            prompt_negative,

            style_positive,
            style_negative,
        });
    }

    const [sdxl_tuple, latent_image, vae] = EfficientLoaderSDXL({
        base_ckpt_name: addCheckpointExtension(params.checkpoint),
        base_clip_skip: -2,
        refiner_ckpt_name: "None",
        refiner_clip_skip: -2,

        positive_ascore: 6,
        negative_ascore: 2,
        vae_name: "Baked VAE",

        positive: prompt_positive,
        negative: prompt_negative,

        token_normalization: "none",
        weight_interpretation: "comfy",

        empty_latent_width: params.width,
        empty_latent_height: params.height,
        batch_size: params.batch_size ?? 1,
    });

    const DEFAULT_SEED = 42;

    const [_1, _2, _3, output_image] = EfficientKSamplerSDXL({
        sdxl_tuple, latent_image, optional_vae: vae,
        noise_seed: params.sampler.seed ?? DEFAULT_SEED,
        steps: params.sampler.steps,
        cfg: params.sampler.cfg,
        sampler_name: params.sampler.sampler_name,
        scheduler: params.sampler.scheduler,
        start_at_step: 0,
        refine_at_step: -1,
        preview_method: "auto",
        vae_decode: "true",
    });

    const now = new Date();
    const filename_prefix = `catalog-${now.getFullYear()}-${now.getMonth().toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    SaveImage({images: output_image, filename_prefix});

    return [workflow, {
        checkpoint_node_id: sdxl_tuple[0],
        sampler_node_id: output_image[0],
    }];
}
