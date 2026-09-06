import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {lstat, mkdir, mkdtemp, readdir, readFile, rm, symlink, utimes, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join, relative, sep} from 'node:path';
import type {TestContext} from 'node:test';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';

// Black-box CLI tests derived only from s0001, s0002, s0004, and s0005.
const executable = fileURLToPath(new URL('../bin/main.js', import.meta.url));
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const oldTime = new Date('2001-02-03T04:05:06Z');

function manifest(name: string, id = 'shared-id') {
    return {
        version: 1,
        fingerprint: 'a'.repeat(64),
        id,
        name,
        output_node: '9',
        variations: [{
            name: 'Prompt',
            target: {node: '6', input: 'text'},
            values: [{value: 'first', label: 'Same', category: 'Samples'}, {value: 'second', label: 'Same'}],
        }],
        entries: {
            0: {
                coordinate: [0],
                prompt_id: 'fixture-prompt',
                images: [{index: 0, file: '0.0.png'}, {index: 1, file: '0.1.png'}],
                workflow: '0.workflow.json',
            },
        },
    };
}

async function fixture(parent: string, directory: string, name: string, id = 'shared-id') {
    const folder = join(parent, directory);
    await mkdir(folder, {recursive: true});
    const metadata = join(folder, 'metadata.json');
    await writeFile(metadata, JSON.stringify(manifest(name, id), null, 2));
    await writeFile(join(folder, '0.0.png'), png);
    await writeFile(join(folder, '0.1.png'), png);
    await writeFile(join(folder, '0.workflow.json'), '{"9":{"class_type":"SaveImage","inputs":{}}}\n');
    for(const file of await readdir(folder)) await utimes(join(folder, file), oldTime, oldTime);
    return metadata;
}

async function workspace(t: TestContext) {
    const cwd = await mkdtemp(join(tmpdir(), 'catalog-web-test-'));
    t.after(async () => { await rm(cwd, {recursive: true, force: true}); });
    const root = join(cwd, 'served');
    await mkdir(root);
    return {cwd, root};
}

function run(cwd: string, root: string, paths: string[]) {
    // An empty PATH prevents accidental optimizer invocation; no backend is supplied.
    const env = {...process.env};
    for(const key of Object.keys(env)) if(key.toLowerCase() === 'path') delete env[key];
    env['PATH'] = '';
    const result = spawnSync(process.execPath, [executable, 'web', '--root', root, ...paths], {
        cwd, env, encoding: 'utf8', timeout: 15_000, windowsHide: true,
    });
    assert.ifError(result.error);
    assert.equal(result.signal, null, `CLI terminated: ${result.stderr}`);
    return result;
}

function assemble(cwd: string, root: string, paths: string[]) {
    const result = run(cwd, root, paths);
    assert.equal(result.status, 0, `web assembly failed:\n${result.stdout}\n${result.stderr}`);
}

function reject(cwd: string, root: string, paths: string[]) {
    const result = run(cwd, root, paths);
    assert.notEqual(result.status, 0, 'invalid web assembly must fail');
    assert.match(result.stdout + result.stderr, /\S/, 'failure must describe the error');
}

type Snapshot = Record<string, {bytes: string; mtime: string}>;

async function snapshot(root: string): Promise<Snapshot> {
    const files: Snapshot = {};
    async function visit(folder: string): Promise<void> {
        for(const entry of await readdir(folder, {withFileTypes: true})) {
            const path = join(folder, entry.name);
            const info = await lstat(path, {bigint: true});
            assert.equal(info.isSymbolicLink(), false, `unexpected link: ${path}`);
            if(info.isDirectory()) await visit(path);
            else {
                assert.ok(info.isFile(), `not a regular file: ${path}`);
                files[relative(root, path)] = {bytes: (await readFile(path)).toString('base64'), mtime: info.mtimeNs.toString()};
            }
        }
    }
    await visit(root);
    return files;
}

function strings(value: unknown): string[] {
    if(typeof value === 'string') return [value];
    if(Array.isArray(value)) return value.flatMap(strings);
    if(value !== null && typeof value === 'object') return Object.values(value).flatMap(strings);
    return [];
}

function recordArrays(value: unknown): unknown[][] {
    if(Array.isArray(value)) return [value, ...value.flatMap(recordArrays)];
    if(value !== null && typeof value === 'object') return Object.values(value).flatMap(recordArrays);
    return [];
}

function hasVersion(value: unknown): boolean {
    if(value === null || typeof value !== 'object') return false;
    return Object.entries(value).some(([key, child]) =>
        (/version/i.test(key) && (typeof child === 'number' || typeof child === 'string')) || hasVersion(child));
}

// The specs do not prescribe the list filename, property names, or version value.
async function catalogList(root: string, generated: string[], expected: {name: string; url: string}[]) {
    const matches: string[] = [];
    for(const path of generated.filter((path) => path.endsWith('.json'))) {
        const value: unknown = JSON.parse(await readFile(join(root, path), 'utf8'));
        const rows = recordArrays(value).find((rows) => rows.length === expected.length && rows.every((row, index) => {
            const item = expected[index];
            assert.ok(item);
            const text = strings(row);
            return text.includes(item.name) && text.includes(item.url);
        }));
        if(rows) {
            assert.ok(hasVersion(value), 'catalog list must declare a schema version');
            matches.push(path);
        }
    }
    assert.equal(matches.length, 1, 'one versioned catalog list must contain the supplied names and ordered relative metadata URLs');
    const path = matches[0];
    assert.ok(path);
    return path;
}

function url(root: string, metadata: string) {
    return relative(root, metadata).split(sep).map(encodeURIComponent).join('/');
}

test('web assembles external nonempty roots in place and skips byte-identical resources', async (t) => {
    const {cwd, root} = await workspace(t);
    const metadata = await fixture(root, 'catalog', 'Partial catalog');
    await mkdir(join(root, 'unrelated'));
    await writeFile(join(root, 'unrelated', 'keep.txt'), 'keep me');
    const before = await snapshot(root);
    assemble(cwd, root, [metadata]);
    const after = await snapshot(root);
    for(const [path, state] of Object.entries(before)) assert.deepEqual(after[path], state, path);
    const generated = Object.keys(after).filter((path) => !(path in before));
    assert.ok(generated.some((path) => path.endsWith('.html')), 'install a static HTML entry point');
    const list = await catalogList(root, generated, [{name: 'Partial catalog', url: url(root, metadata)}]);
    // Age shared resources so an unconditional rewrite cannot hide in timestamp resolution.
    for(const path of generated.filter((path) => path !== list)) await utimes(join(root, path), oldTime, oldTime);
    const first = await snapshot(root);
    assemble(cwd, root, [metadata]);
    const second = await snapshot(root);
    assert.deepEqual(Object.keys(second).sort(), Object.keys(first).sort(), 'no extra catalog copies or resource files');
    for(const [path, state] of Object.entries(first)) {
        if(path !== list) assert.deepEqual(second[path], state, path);
    }
});

test('web preserves argument order, encodes relative URLs, and accepts duplicate IDs and names', async (t) => {
    const {cwd, root} = await workspace(t);
    const first = await fixture(root, 'z space # % 한글', 'Repeated name');
    const second = await fixture(root, 'a space # % 日本語', 'Repeated name');
    const before = await snapshot(root);
    assemble(cwd, relative(cwd, root), [relative(cwd, first), second]);
    const after = await snapshot(root);
    await catalogList(root, Object.keys(after).filter((path) => !(path in before)), [
        {name: 'Repeated name', url: url(root, first)},
        {name: 'Repeated name', url: url(root, second)},
    ]);
    for(const [path, state] of Object.entries(before)) assert.deepEqual(after[path], state, path);
});

test('replacing the catalog list retains omitted catalog outputs', async (t) => {
    const {cwd, root} = await workspace(t);
    const first = await fixture(root, 'one', 'One');
    const second = await fixture(root, 'two', 'Two');
    const before = await snapshot(root);
    assemble(cwd, root, [first, second]);
    const installed = await snapshot(root);
    const generated = Object.keys(installed).filter((path) => !(path in before));
    assemble(cwd, root, [second]);
    await catalogList(root, generated, [{name: 'Two', url: url(root, second)}]);
    const after = await snapshot(root);
    for(const [path, state] of Object.entries(before)) assert.deepEqual(after[path], state, path);
});

type Metadata = ReturnType<typeof manifest>;
const invalidCases: {name: string; change: (metadata: Metadata, folder: string) => void | Promise<void>}[] = [
    {name: 'unsupported version', change: (m) => { m.version = 99; }},
    {name: 'out-of-range coordinate', change: (m) => { m.entries['0'].coordinate = [2]; }},
    {name: 'coordinate key mismatch', change: (m) => { m.entries['0'].coordinate = [1]; }},
    {name: 'wrong coordinate dimension', change: (m) => { m.entries['0'].coordinate = [0, 0]; }},
    {name: 'empty image batch', change: (m) => { m.entries['0'].images = []; }},
    {name: 'traversing image filename', change: (m) => { m.entries['0'].images = [{index: 0, file: '../0.0.png'}]; }},
    {name: 'missing image', change: async (_m, folder) => { await rm(join(folder, '0.1.png')); }},
    {name: 'empty image', change: async (_m, folder) => { await writeFile(join(folder, '0.0.png'), ''); }},
    {name: 'directory instead of image', change: async (_m, folder) => { await rm(join(folder, '0.0.png')); await mkdir(join(folder, '0.0.png')); }},
    {name: 'missing workflow sidecar', change: async (_m, folder) => { await rm(join(folder, '0.workflow.json')); }},
    {name: 'empty workflow sidecar', change: async (_m, folder) => { await writeFile(join(folder, '0.workflow.json'), ''); }},
];

for(const invalid of invalidCases) {
    test(`web rejects ${invalid.name} before changing installed output`, async (t) => {
        const {cwd, root} = await workspace(t);
        const good = await fixture(root, 'good', 'Good');
        assemble(cwd, root, [good]);
        const bad = await fixture(root, 'bad', 'Bad');
        const metadata = manifest('Bad');
        await invalid.change(metadata, dirname(bad));
        await writeFile(bad, JSON.stringify(metadata));
        const before = await snapshot(root);
        reject(cwd, root, [good, bad]);
        assert.deepEqual(await snapshot(root), before);
    });
}

for(const kind of ['missing metadata', 'malformed JSON', 'duplicate resolved path', 'outside root'] as const) {
    test(`web rejects ${kind} before changing installed output`, async (t) => {
        const {cwd, root} = await workspace(t);
        const good = await fixture(root, 'good', 'Good');
        assemble(cwd, root, [good]);
        let bad: string;
        switch(kind) {
            case 'missing metadata': bad = join(root, 'missing.json'); break;
            case 'malformed JSON':
                bad = join(root, 'bad.json');
                await writeFile(bad, '{');
                break;
            case 'duplicate resolved path': bad = relative(cwd, good); break;
            case 'outside root': bad = await fixture(cwd, 'served-sibling', 'Outside'); break;
        }
        const before = await snapshot(root);
        reject(cwd, root, [good, bad]);
        assert.deepEqual(await snapshot(root), before);
    });
}

test('web rejects catalog directory links escaping the served root (Windows junctions)', async (t) => {
    const {cwd, root} = await workspace(t);
    const good = await fixture(root, 'good', 'Good');
    assemble(cwd, root, [good]);
    const outside = await fixture(cwd, 'outside', 'Outside');
    const before = await snapshot(root);
    const external = await snapshot(dirname(outside));
    const link = join(root, 'linked');
    await symlink(dirname(outside), link, process.platform === 'win32' ? 'junction' : 'dir');
    try {
        reject(cwd, root, [good, join(link, 'metadata.json')]);
        assert.ok((await lstat(link)).isSymbolicLink());
        assert.deepEqual(await snapshot(dirname(outside)), external);
    } finally {
        await rm(link, {force: true});
    }
    assert.deepEqual(await snapshot(root), before);
});

test('web rejects canonical source roots and catalogs under reserved assets before writing', async (t) => {
    const {cwd, root} = await workspace(t);
    const good = await fixture(root, 'good', 'Good');
    const source = fileURLToPath(new URL('../../static/', import.meta.url));
    const sourceBefore = await snapshot(source);
    const result = run(cwd, source, [good]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /source resources/i);
    assert.deepEqual(await snapshot(source), sourceBefore);
    const reserved = await fixture(root, 'assets/catalog', 'Reserved');
    const before = await snapshot(root);
    reject(cwd, root, [good, reserved]);
    assert.deepEqual(await snapshot(root), before);
});

test('web rejects symlinks occupying reserved viewer output entries (Windows junctions)', async (t) => {
    const {cwd, root} = await workspace(t);
    const good = await fixture(root, 'good', 'Good');
    const initial = await snapshot(root);
    assemble(cwd, root, [good]);
    const installed = await snapshot(root);
    const generated = Object.keys(installed).filter((path) => !(path in initial));
    assert.ok(generated.length > 0);
    const target = join(cwd, 'external-target');
    await mkdir(target);
    await writeFile(join(target, 'keep.txt'), 'must not be changed');
    const external = await snapshot(target);
    for(const path of generated) {
        await t.test(path, async () => {
            const reserved = join(root, path);
            const saved = installed[path];
            assert.ok(saved);
            await rm(reserved);
            const before = await snapshot(root);
            await symlink(target, reserved, process.platform === 'win32' ? 'junction' : 'dir');
            try {
                reject(cwd, root, [good]);
                assert.ok((await lstat(reserved)).isSymbolicLink(), 'reserved link must not be replaced');
                assert.deepEqual(await snapshot(target), external);
            } finally {
                await rm(reserved, {force: true});
            }
            assert.deepEqual(await snapshot(root), before, 'other resources and catalog list must stay unchanged');
            await writeFile(reserved, Buffer.from(saved.bytes, 'base64'));
        });
    }
});
