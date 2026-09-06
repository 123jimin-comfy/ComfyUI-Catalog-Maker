import {randomUUID} from 'node:crypto';
import {lstat, mkdir, readFile, realpath, rename, rm, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {metadataSchema, validateEntries} from '../catalog/metadata.ts';
import type {WebOptions} from '../cli/options.ts';

const sourceRoot = fileURLToPath(new URL('../../static/', import.meta.url));
const resources = ['index.html', 'assets/app.js', 'assets/catalog.js', 'assets/style.css'] as const;

function missing(error: unknown): boolean { return error instanceof Error && 'code' in error && error.code === 'ENOENT'; }

function inside(root: string, target: string): boolean {
    const relative = path.relative(root, target);
    return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function regularFile(root: string, filename: string): Promise<void> {
    const resolved = await realpath(filename);
    if(!inside(root, filename) || !inside(root, resolved)) throw new Error(`Catalog file must remain inside the site root: ${filename}`);
    catalogLocation(root, path.dirname(resolved));
    const info = await stat(filename);
    if(!info.isFile() || info.size === 0) throw new Error(`Expected a nonempty regular catalog file: ${filename}`);
}

function catalogLocation(root: string, directory: string): void {
    const first = path.relative(root, directory).split(path.sep)[0]?.toLowerCase();
    if(!inside(root, directory) || !first || ['assets', 'index.html', 'catalogs.json'].includes(first)) {
        throw new Error(`Catalog directory must be inside the site root and separate from reserved viewer resources: ${directory}`);
    }
}

async function checkDestination(filename: string, directory = false): Promise<void> {
    try {
        const info = await lstat(filename);
        if(info.isSymbolicLink() || (directory ? !info.isDirectory() : !info.isFile())) throw new Error(`Incompatible viewer output entry: ${filename}`);
    } catch (error) { if(!missing(error)) throw error; }
}

async function replaceFile(filename: string, contents: Buffer, signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    await checkDestination(filename);
    try {
        if((await readFile(filename)).equals(contents)) return;
    } catch (error) { if(!missing(error)) throw error; }
    const temporary = path.join(path.dirname(filename), `.viewer-${randomUUID()}.tmp`);
    try {
        await writeFile(temporary, contents, {flag: 'wx', signal});
        signal.throwIfAborted();
        await rename(temporary, filename);
    } finally { await rm(temporary, {force: true}); }
}

/** Assemble only common assets and the index; catalog output is always read in place. */
export async function assembleSite(options: WebOptions, signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    const root = await realpath(path.resolve(options.root));
    const source = await realpath(sourceRoot);
    if(inside(root, path.join(source, 'index.html')) || inside(root, path.join(source, 'assets')) || inside(path.join(source, 'assets'), root)) {
        throw new Error('Site root overlaps canonical viewer source resources');
    }
    if(options.catalogs.length === 0) throw new Error('At least one catalog metadata file is required');
    const seen = new Set<string>();
    const catalogs: {name: string; metadata: string}[] = [];
    for(const input of options.catalogs) {
        signal.throwIfAborted();
        // Resolve the directory separately so image paths keep the metadata URL's base,
        // including when the metadata file itself is a symlink to another directory.
        const absolute = path.resolve(input);
        const directory = await realpath(path.dirname(absolute));
        const filename = path.join(directory, path.basename(absolute));
        const lexicalRoot = path.resolve(options.root);
        catalogLocation(lexicalRoot, path.dirname(absolute));
        catalogLocation(root, directory);
        await regularFile(root, filename);
        const resolved = await realpath(filename);
        const identity = process.platform === 'win32' ? resolved.toLowerCase() : resolved;
        if(seen.has(identity)) throw new Error(`Duplicate catalog metadata path: ${input}`);
        seen.add(identity);
        try {
            const metadata = metadataSchema.assert(JSON.parse(await readFile(filename, 'utf8')));
            validateEntries(metadata);
            for(const entry of Object.values(metadata.entries)) {
                for(const image of entry.images) await regularFile(root, path.join(directory, image.file));
                if(entry.workflow) await regularFile(root, path.join(directory, entry.workflow));
            }
            const relative = path.relative(root, filename).split(path.sep).map(encodeURIComponent).join('/');
            catalogs.push({name: metadata.name, metadata: relative});
        } catch (cause) { throw new Error(`Invalid catalog ${input}: ${String(cause)}`, {cause}); }
    }

    // Preflight every reserved destination and load every source before any write.
    await checkDestination(path.join(root, 'assets'), true);
    await checkDestination(path.join(root, 'catalogs.json'));
    const writes: {filename: string; contents: Buffer}[] = [];
    for(const resource of resources) {
        const filename = path.join(root, resource);
        await checkDestination(filename);
        writes.push({filename, contents: await readFile(path.join(source, resource))});
    }
    signal.throwIfAborted();
    await mkdir(path.join(root, 'assets'), {recursive: true});
    for(const write of writes) await replaceFile(write.filename, write.contents, signal);
    await replaceFile(path.join(root, 'catalogs.json'), Buffer.from(JSON.stringify({version: 1, catalogs}, null, 2) + '\n'), signal);
}
