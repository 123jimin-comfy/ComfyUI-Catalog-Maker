//@ts-check

/** @import {ParameterConfig} from "./parameter" */

import wildcardMatch from "wildcard-match";

/**
 * @param {string} checkpoint_path
 * @param {Array<Partial<ParameterConfig & {pattern?: string}>>} parameters_list 
 * @returns {ParameterConfig}
 */
export function createParameters(checkpoint_path, ...parameters_list) {
    /** @type {ParameterConfig} */
    const curr_params = {
        workflow: "",
        
        checkpoint: checkpoint_path,
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

    for(const parameters of parameters_list) {
        let match = true;

        if(parameters.pattern) {
            match = wildcardMatch(parameters.pattern)(checkpoint_path);
        }

        if(match) {
            mergeParameters(curr_params, parameters);
        }
    }

    return curr_params;
}

/**
 * @param {Omit<ParameterConfig, 'pattern'>} target 
 * @param {Partial<ParameterConfig>} patch 
 */
export function mergeParameters(target, patch) {
    for(const [k, v] of Object.entries(patch)) {
        if(k === 'pattern') continue;

        if(Array.isArray(v)) {
            const orig = target[k];

            /** @type {string[]} */
            const merged = [];

            for(const vi of v) {
                if(vi === '*') {
                    merged.push(...orig);
                } else {
                    merged.push(vi);
                }
            }

            target[k] = merged;
        } else {
            target[k] = v;
        }
    }
}

/**
 * Change the checkpoint name into directory names.
 * @param {string} checkpoint
 * @returns {string[]}
 */
export function checkpointToDirNames(checkpoint) {
    checkpoint = checkpoint.replace(/\.[a-z]+$/i, "");

    const dir_names = [];

    for(let component of checkpoint.split(/[\\/]/)) {
        component = component.toLowerCase().trim().replace(/[^a-z0-9\-]+/g, '_');
        if(!component) continue;

        dir_names.push(component);
    }

    return dir_names;
}