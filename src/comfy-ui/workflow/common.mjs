//@ts-check

/**
 * @param {string} checkpoint_name 
 * @returns {string}
 */
export function addCheckpointExtension(checkpoint_name) {
    if(!/\.(?:safetensors)$/i.test(checkpoint_name)) {
        checkpoint_name += ".safetensors";
    }

    return checkpoint_name;
}