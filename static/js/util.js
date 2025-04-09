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

/**
 * Returns the path to the image file for the given checkpoint and generation parameters.
 * 
 * @param {string[]} axis_value_ids 
 * @param {string} checkpoint
 * @return {string[]} The path to the image file.
 */
function getImagePath(axis_value_ids, checkpoint) {
    return [
        toFileName(checkpoint),
        axis_value_ids.length === 0 ? 'image' : axis_value_ids.join('_'),
    ];
}
