import assert from 'node:assert/strict';
import {mkdtemp, readdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';

import {generateCatalog} from './generate.ts';

test('failed batch is incomplete and resume removes stale images from that entry', async (t) => {
    const root = await mkdtemp(path.join(tmpdir(), 'catalog-batch-'));
    t.after(async () => { await rm(root, {recursive: true, force: true}); });
    const output = path.join(root, 'output');
    const backend = path.join(root, 'backend.toml'), catalog = path.join(root, 'catalog.toml');
    await writeFile(backend, '[comfy]\nurl = "http://localhost:8188"\n');
    await writeFile(catalog, 'id = "batch"\nname = "Batch"\nworkflow = "workflow.json"\n[[variations]]\nname = "Value"\ntarget = {node = "1", input = "value"}\nvalues = [{value = 1}]\n');
    await writeFile(path.join(root, 'workflow.json'), JSON.stringify({1: {class_type: 'Output', inputs: {value: 1}}}));
    const options = {backend, catalog, output, force: false, reset: false, genInfo: false, optimize: false, quality: [85, 95] as const};
    let batch = 3, converted = 0, fail = false, closed = 0;
    const dependencies = {
        checkOptimizer: async () => 'test',
        connect: () => ({
            definitions: async () => ({Output: {output_node: true, input: {required: {value: ['INT']}}}}),
            execute: async () => ({promptId: 'job', images: (async function* () {
                for(let i = 0; i < batch; i++) yield Buffer.from(`image ${i}`);
            })()}),
            close: () => { closed++; },
        }),
        image: async (bytes: Buffer) => {
            converted++;
            if(fail && converted === 3) throw new Error('image conversion failed');
            return bytes;
        },
    };
    const signal = new AbortController().signal;
    await generateCatalog(options, signal, () => {}, dependencies);
    fail = true;
    converted = 0;
    await assert.rejects(generateCatalog({...options, force: true}, signal, () => {}, dependencies), /image conversion failed/);
    const meta = JSON.parse(await readFile(path.join(output, 'metadata.json'), 'utf8')) as {entries: object};
    assert.deepEqual(meta.entries, {});
    assert.ok((await readdir(output)).includes('0.1.png'));
    fail = false;
    batch = 1;
    await generateCatalog(options, signal, () => {}, dependencies);
    assert.deepEqual((await readdir(output)).sort(), ['0.0.png', 'metadata.json']);
    assert.equal(closed, 3);
});
