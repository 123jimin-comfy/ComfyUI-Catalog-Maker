//@ts-check

import fs from "node:fs/promises";

/**
 * Check if a file exists.
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
 * Makes the name into a valid file name.
 * 
 * @param {string} name 
 */
export function toFileName(name) {
    // Removes file extension.
    name = name.replace(/\.[^/.]+$/, "");

    const dir_names = [];

    for(let component of name.split(/[\\/]+/)) {
        component = component.trim().toLowerCase().replace(/[^a-z0-9\-]+/g, '-');
        if(!component) continue;

        dir_names.push(component);
    }

    return dir_names.join('_');
}