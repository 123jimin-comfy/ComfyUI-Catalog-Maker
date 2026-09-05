import path from 'node:path';

import type {RunOptions} from '../cli/options.ts';
import {type ComfyConnection, createConnection} from '../comfy/client.ts';
import {loadConfiguration} from '../config/load.ts';
import {checkOptimizer, preparePng} from '../image/png.ts';
import {selectOutput} from '../workflow/graph.ts';
import {applyCoordinate, coordinates} from '../workflow/variations.ts';
import {atomicWrite, clearCoordinateFiles, imageName, isComplete, prepareOutput, saveMetadata, workflowName} from './files.ts';
import {type CompletedEntry, newMetadata} from './metadata.ts';

interface Dependencies {
    connect: typeof createConnection;
    image: typeof preparePng;
    checkOptimizer: typeof checkOptimizer;
}

const defaults: Dependencies = {connect: createConnection, image: preparePng, checkOptimizer};

export async function generateCatalog(options: RunOptions, signal: AbortSignal, report: (message: string) => void, dependencies: Dependencies = defaults): Promise<void> {
    const loaded = await loadConfiguration(options.backend, options.catalog);
    if(options.optimize) await dependencies.checkOptimizer(signal);
    const connection: ComfyConnection = dependencies.connect(loaded.backend, signal);
    try {
        const outputNode = selectOutput(loaded.graph, loaded.catalog, await connection.definitions());
        signal.throwIfAborted();
        const directory = path.resolve(options.output);
        const metadata = await prepareOutput(directory, newMetadata(loaded.catalog, loaded.graph, outputNode), options.reset, options.force, loaded.sourcePaths);
        for(const coordinate of coordinates(loaded.catalog.variations)) {
            signal.throwIfAborted();
            const key = coordinate.join('-');
            const previous = metadata.entries[key];
            if(!options.force && await isComplete(directory, previous, options.genInfo)) {
                report(`Skipping ${key}`);
                continue;
            }
            delete metadata.entries[key];
            await saveMetadata(directory, metadata);
            await clearCoordinateFiles(directory, coordinate);
            try {
                report(`Generating ${key}`);
                const graph = applyCoordinate(loaded.graph, loaded.catalog.variations, coordinate);
                const execution = await connection.execute(graph, outputNode);
                const completed: CompletedEntry = {coordinate, prompt_id: execution.promptId, images: []};
                let index = 0;
                for await (const original of execution.images) {
                    signal.throwIfAborted();
                    const image = await dependencies.image(original, options, signal);
                    const file = imageName(coordinate, index);
                    await atomicWrite(directory, file, image);
                    completed.images.push({index, file});
                    index++;
                }
                if(index === 0) throw new Error(`Output node ${outputNode} returned no images`);
                if(options.genInfo) {
                    completed.workflow = workflowName(coordinate);
                    await atomicWrite(directory, completed.workflow, JSON.stringify(graph, null, 2) + '\n');
                }
                metadata.entries[key] = completed;
                await saveMetadata(directory, metadata);
            } catch (cause) { throw new Error(`Catalog entry ${key}: ${String(cause)}`, {cause}); }
        }
    } finally { connection.close(); }
}
