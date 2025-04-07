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
        exclude: false,
        workflow: "",
        width: 896,
        height: 1152,
        styles: [],
        prompts: [],
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

}