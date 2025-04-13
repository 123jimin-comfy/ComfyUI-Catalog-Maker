//@ts-check

/** @import {ParameterConfig} from "./parameter" */

/** @type {Omit<ParameterConfig, 'checkpoint'>} */
export const DEFAULT_PARAMETERS = {
    pipe: "",
    
    prompt: "",

    width: 896,
    height: 1152,

    seed: 42,
    steps: 20,
    cfg: 7.5,
    sampler_name: "dpmpp_sde_gpu",
    scheduler: "karras",
    denoise: 1.0,
};
