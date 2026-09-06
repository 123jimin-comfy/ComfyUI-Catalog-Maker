import {createHash} from 'node:crypto';

import {type} from 'arktype';

import {type CatalogConfig, variation} from '../config/schema.ts';
import type {ApiGraph} from '../workflow/graph.ts';

export const completedEntry = type({
    "coordinate": '(number.integer >= 0)[]',
    "prompt_id": 'string > 0',
    "images": type({index: 'number.integer >= 0', file: 'string > 0'}).array().atLeastLength(1),
    'workflow?': 'string > 0',
    '+': 'reject',
});
export const metadataSchema = type({
    "version": '1', "fingerprint": 'string > 0', "id": 'string', "name": 'string', "output_node": 'string > 0',
    "variations": variation.array().atLeastLength(1), "entries": type({'[string]': completedEntry}), '+': 'reject',
});
export type Metadata = typeof metadataSchema.infer;
export type CompletedEntry = typeof completedEntry.infer;

export function imageName(coordinate: readonly number[], index: number): string { return `${coordinate.join('-')}.${index}.png`; }
export function workflowName(coordinate: readonly number[]): string { return `${coordinate.join('-')}.workflow.json`; }

export function validateEntries(metadata: Metadata): void {
    for(const [key, entry] of Object.entries(metadata.entries)) {
        if(entry.coordinate.length !== metadata.variations.length || key !== entry.coordinate.join('-') || entry.coordinate.some((index, axis) => index >= metadata.variations[axis]!.values.length)) throw new Error(`Invalid metadata coordinate ${key}`);
        for(const [index, image] of entry.images.entries()) {
            if(image.index !== index || image.file !== imageName(entry.coordinate, index)) throw new Error(`Invalid metadata image for ${key}`);
        }
        if(entry.workflow && entry.workflow !== workflowName(entry.coordinate)) throw new Error(`Invalid metadata workflow for ${key}`);
    }
}

function canonical(data: unknown): string {
    if(Array.isArray(data)) return `[${data.map(canonical).join(',')}]`;
    if(data !== null && typeof data === 'object') {
        return `{${Object.entries(data).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, value]) => `${JSON.stringify(key)}:${canonical(value)}`).join(',')}}`;
    }
    return JSON.stringify(data);
}

export function newMetadata(catalog: CatalogConfig, graph: ApiGraph, outputNode: string): Metadata {
    const {workflow: _workflowFile, ...config} = catalog;
    const fingerprint = createHash('sha256').update(canonical({config, graph, outputNode})).digest('hex');
    return {version: 1, fingerprint, id: catalog.id, name: catalog.name, output_node: outputNode, variations: catalog.variations, entries: {}};
}
