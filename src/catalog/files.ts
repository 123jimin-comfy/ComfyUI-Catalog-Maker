import {randomUUID} from 'node:crypto';
import {lstat, mkdir, readdir, readFile, realpath, rename, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';

import {type CompletedEntry, type Metadata, metadataSchema} from './metadata.ts';

export function imageName(coordinate: readonly number[], index: number): string { return `${coordinate.join('-')}.${index}.png`; }
export function workflowName(coordinate: readonly number[]): string { return `${coordinate.join('-')}.workflow.json`; }

function missing(error: unknown): boolean { return error instanceof Error && 'code' in error && error.code === 'ENOENT'; }

function localPath(directory: string, filename: string): string {
    if(filename !== 'metadata.json' && !/^\d+(?:-\d+)*\.(?:\d+\.png|workflow\.json)$/.test(filename)) throw new Error(`Invalid catalog filename: ${filename}`);
    return path.join(directory, filename);
}

export async function atomicWrite(directory: string, filename: string, data: string | Buffer): Promise<void> {
    const destination = localPath(directory, filename);
    const temporary = path.join(directory, `.catalog-${randomUUID()}.tmp`);
    try {
        await writeFile(temporary, data, {flag: 'wx'});
        await rename(temporary, destination);
    } finally { await rm(temporary, {force: true}); }
}

export async function saveMetadata(directory: string, metadata: Metadata): Promise<void> {
    await atomicWrite(directory, 'metadata.json', JSON.stringify(metadata, null, 2) + '\n');
}

export async function prepareOutput(directory: string, expected: Metadata, reset: boolean, force: boolean, sourcePaths: readonly string[]): Promise<Metadata> {
    const absolute = path.resolve(directory);
    if(absolute === path.parse(absolute).root) throw new Error('The filesystem root cannot be a catalog output directory');
    try {
        if((await lstat(absolute)).isSymbolicLink()) throw new Error('Catalog output directory cannot be a symbolic link');
    } catch (error) { if(!missing(error)) throw error; }
    await mkdir(absolute, {recursive: true});
    if(reset) {
        const resolved = await realpath(absolute);
        for(const source of sourcePaths) {
            const relative = path.relative(resolved, await realpath(source));
            if(!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)) throw new Error('--reset would delete an input configuration or workflow file');
        }
        for(const entry of await readdir(absolute)) await rm(path.join(resolved, entry), {recursive: true, force: true});
    }
    let previous: Metadata | null = null;
    try {
        previous = metadataSchema.assert(JSON.parse(await readFile(path.join(absolute, 'metadata.json'), 'utf8')));
        validateEntries(previous);
    } catch (error) {
        if(!missing(error)) throw new Error(`Cannot read catalog metadata; use --reset to rebuild: ${String(error)}`, {cause: error});
    }
    if(previous && previous.fingerprint !== expected.fingerprint) {
        if(!force) throw new Error('Catalog configuration or workflow fingerprint changed; use --force or --reset to regenerate');
        // Clear completion records before touching files referenced by the old manifest.
        await saveMetadata(absolute, expected);
        for(const entry of Object.values(previous.entries)) await removeEntryFiles(absolute, entry);
        previous = null;
    }
    const result = previous ?? expected;
    await saveMetadata(absolute, result);
    return result;
}

function validateEntries(metadata: Metadata): void {
    for(const [key, entry] of Object.entries(metadata.entries)) {
        if(entry.coordinate.length !== metadata.variations.length || key !== entry.coordinate.join('-') || entry.coordinate.some((index, axis) => index >= metadata.variations[axis]!.values.length)) throw new Error(`Invalid metadata coordinate ${key}`);
        for(const [index, image] of entry.images.entries()) {
            if(image.index !== index || image.file !== imageName(entry.coordinate, index)) throw new Error(`Invalid metadata image for ${key}`);
        }
        if(entry.workflow && entry.workflow !== workflowName(entry.coordinate)) throw new Error(`Invalid metadata workflow for ${key}`);
    }
}

export async function isComplete(directory: string, entry: CompletedEntry | undefined, genInfo: boolean): Promise<boolean> {
    if(!entry || (genInfo && !entry.workflow)) return false;
    for(const filename of [...entry.images.map((image) => image.file), ...(entry.workflow ? [entry.workflow] : [])]) {
        try {
            const info = await lstat(localPath(directory, filename));
            if(!info.isFile() || info.size === 0) return false;
        } catch (error) { if(missing(error)) return false; throw error; }
    }
    return true;
}

export async function removeEntryFiles(directory: string, entry: CompletedEntry): Promise<void> {
    for(const file of [...entry.images.map((image) => image.file), ...(entry.workflow ? [entry.workflow] : [])]) await rm(localPath(directory, file), {force: true});
}

export async function clearCoordinateFiles(directory: string, coordinate: readonly number[]): Promise<void> {
    const prefix = `${coordinate.join('-')}.`;
    for(const filename of await readdir(directory)) {
        if(filename.startsWith(prefix) && /^(?:\d+\.png|workflow\.json)$/.test(filename.slice(prefix.length))) {
            await rm(localPath(directory, filename), {force: true});
        }
    }
}
