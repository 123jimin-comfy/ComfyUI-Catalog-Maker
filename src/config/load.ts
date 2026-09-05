import {readFile} from 'node:fs/promises';
import path from 'node:path';

import toml from 'toml';

import {validateGraph} from '../workflow/graph.ts';
import {backendConfig, catalogConfig} from './schema.ts';

export async function loadConfiguration(backendPath: string, catalogPath: string) {
    const backend = backendConfig.assert(toml.parse(await readFile(backendPath, 'utf8')));
    const catalog = catalogConfig.assert(toml.parse(await readFile(catalogPath, 'utf8')));
    const url = new URL(backend.comfy.url);
    if(!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
        throw new Error('ComfyUI URL must be HTTP(S), without credentials, query, or fragment; use comfy.auth for authentication.');
    }
    const workflowPath = path.resolve(path.dirname(catalogPath), catalog.workflow);
    const graph = validateGraph(JSON.parse(await readFile(workflowPath, 'utf8')), catalog);
    return {backend, catalog, graph, sourcePaths: [path.resolve(backendPath), path.resolve(catalogPath), workflowPath]};
}
