//@ts-check

export {toFileName, getImagePath, advanceIndices} from "../static/js/util.js";

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
