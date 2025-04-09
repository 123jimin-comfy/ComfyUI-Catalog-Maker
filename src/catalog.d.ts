export interface CatalogAxisMetadata {
    target: string;
    name: string;

    values: Array<{
        id: string;
        group?: string;
        value: string|number;
    }>;
}

/** Catalog metadata, stored as JSON. */
export interface CatalogMetadata {
    id: string;
    name: string;
    checkpoint: string|null;
    axes: CatalogAxisMetadata[];
}