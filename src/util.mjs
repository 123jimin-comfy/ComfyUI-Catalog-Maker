//@ts-check

export {toFileName, getImagePath, advanceIndices} from "../static/js/util.js";

import fs from "node:fs/promises";

/**
 * Check if a file exists. (Usually this may cause race condition, but as we're using files like caches, race condition is not much of a concern.)
 * @param {string} file_path 
 * @returns {Promise<boolean>}
 */
export async function fileExists(file_path) {
    try {
        await fs.access(file_path);
        return true;
    } catch {
        return false;
    }
}

/**
 * @param {string} checkpoint_name 
 * @returns {string}
 */
export function addCheckpointExtension(checkpoint_name) {
    if(!/\.(?:safetensors|ckpt)$/i.test(checkpoint_name)) {
        checkpoint_name += ".safetensors";
    }

    return checkpoint_name;
}

/**
 * @returns {string}
 */
export function createFilenamePrefix() {
    const now = new Date();
    return `catalog-${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
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
