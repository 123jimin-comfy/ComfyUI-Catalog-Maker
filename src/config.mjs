//@ts-check

/** @import {ParameterConfig} from "./config" */

import wildcardMatch from "wildcard-match";

/**
 * @param {Array<Partial<ParameterConfig>>} parameters_list 
 * @param {string} checkpoint_path
 * @returns {Omit<ParameterConfig, 'pattern'>}
 */
export function createParameters(parameters_list, checkpoint_path) {
    /** @type {Omit<ParameterConfig, 'pattern'>} */
    const curr_params = {
        workflow: "",
        width: 896,
        height: 1152,
        seed: 42,
        styles: [],
        prompt_ids: [],
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