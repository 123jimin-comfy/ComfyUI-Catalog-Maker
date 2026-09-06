/** Browser-only interpretation of the current generated catalog format. */
function object(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function require(condition, message) {
    if(!condition) throw new Error(message);
}

export function readCatalogList(data, listURL) {
    require(object(data) && data.version === 1 && Array.isArray(data.catalogs), 'Unsupported or invalid catalog list.');
    const base = new URL('./', listURL);
    return data.catalogs.map((item) => {
        require(object(item) && typeof item.name === 'string' && typeof item.metadata === 'string', 'Invalid catalog list entry.');
        const relative = item.metadata;
        require(relative.length > 0 && !/[\\?#]/.test(relative) && !relative.startsWith('/') && !/^[a-z][a-z\d+.-]*:/i.test(relative), 'Catalog metadata must use a relative URL.');
        for(const segment of relative.split('/')) {
            const decoded = decodeURIComponent(segment);
            require(decoded !== '..' && decoded !== '.' && !/[\\/]/.test(decoded), 'Invalid catalog metadata path.');
        }
        const url = new URL(relative, base);
        require(url.origin === base.origin && url.pathname.startsWith(base.pathname), 'Catalog metadata must be inside the website.');
        return {name: item.name, url};
    });
}

export function readCatalog(data) {
    require(object(data) && data.version === 1, 'Unsupported catalog metadata version.');
    require(typeof data.name === 'string' && typeof data.id === 'string' && Array.isArray(data.variations) && data.variations.length > 0 && object(data.entries), 'Invalid catalog metadata.');
    for(const variation of data.variations) {
        require(object(variation) && typeof variation.name === 'string' && Array.isArray(variation.values) && variation.values.length > 0, 'Invalid catalog variation.');
        for(const candidate of variation.values) {
            require(object(candidate) && Object.hasOwn(candidate, 'value') && (!Object.hasOwn(candidate, 'label') || typeof candidate.label === 'string') && (!Object.hasOwn(candidate, 'category') || typeof candidate.category === 'string'), 'Invalid catalog candidate.');
        }
    }
    for(const [key, entry] of Object.entries(data.entries)) {
        require(object(entry) && Array.isArray(entry.coordinate) && entry.coordinate.length === data.variations.length, 'Invalid entry coordinate.');
        require(entry.coordinate.every((index, axis) => Number.isSafeInteger(index) && index >= 0 && index < data.variations[axis].values.length) && entry.coordinate.join('-') === key, 'Invalid entry coordinate.');
        require(Array.isArray(entry.images) && entry.images.length > 0, 'Invalid entry image batch.');
        entry.images.forEach((image, index) => {
            require(object(image) && image.index === index && image.file === `${key}.${index}.png`, 'Invalid entry image filename.');
        });
    }
    return data;
}

export function orderedEntries(catalog) {
    return Object.values(catalog.entries).sort((left, right) => {
        for(let axis = 0; axis < left.coordinate.length; axis++) {
            const difference = left.coordinate[axis] - right.coordinate[axis];
            if(difference) return difference;
        }
        return 0;
    });
}

export function candidateText(candidate) {
    return candidate.label ?? (typeof candidate.value === 'string' ? candidate.value : JSON.stringify(candidate.value));
}

export function combinationCount(catalog) {
    return catalog.variations.reduce((total, variation) => total * BigInt(variation.values.length), 1n).toLocaleString();
}
