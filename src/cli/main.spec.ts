import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp, readdir, readFile, rm, writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test, type TestContext} from 'node:test';
import {fileURLToPath} from 'node:url';

import sharp from 'sharp';

const executable = fileURLToPath(new URL('../bin/main.js', import.meta.url));
const workflow = {
    '60:19': {class_type: 'Sampler', inputs: {cfg: 4, seed: 42}},
    '46': {class_type: 'SaveImage', inputs: {images: ['60:19', 0]}},
};

async function fixture(t: TestContext, options: {batch?: number; fail?: boolean; reject?: boolean; empty?: boolean; drop?: boolean; jpeg?: boolean} = {}) {
    const root = await mkdtemp(path.join(tmpdir(), 'catalog-test-'));
    const output = path.join(root, 'output');
    const prompts: Record<string, unknown>[] = [];
    const png = await sharp({create: {width: 16, height: 16, channels: 4, background: '#33669980'}}).png().toBuffer();
    const downloaded = options.jpeg ? await sharp(png).jpeg().toBuffer() : png;
    const server = createServer((req, res) => {
        void (async () => {
            assert.equal(req.headers.authorization, `Basic ${Buffer.from('user:password').toString('base64')}`);
            const url = new URL(req.url ?? '/', 'http://localhost');
            res.setHeader('content-type', 'application/json');
            if(url.pathname === '/comfy/object_info') {
                res.end(JSON.stringify({
                    Sampler: {input: {required: {cfg: ['FLOAT', {min: 0, max: 100}], seed: ['INT', {}]}}, output_node: false},
                    SaveImage: {input: {required: {images: ['IMAGE']}}, output_node: true},
                    Text: {input: {required: {text: ['STRING']}}, output_node: false},
                }));
            } else if(url.pathname === '/comfy/prompt') {
                let body = '';
                for await (const chunk of req) body += String(chunk);
                const parsed = JSON.parse(body) as {prompt: Record<string, unknown>};
                prompts.push(parsed.prompt);
                if(options.drop) {
                    req.socket.destroy();
                    return;
                }
                if(options.reject) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({error: 'invalid graph', node_errors: {'60:19': {errors: [{message: 'invalid cfg'}]}}}));
                } else res.end(JSON.stringify({prompt_id: `job-${prompts.length}`, node_errors: {}}));
            } else if(url.pathname.startsWith('/comfy/history/')) {
                const id = url.pathname.split('/').at(-1) ?? '';
                res.end(JSON.stringify({
                    unrelated: {status: {completed: true, status_str: 'success'}, outputs: {}},
                    [id]: {
                        status: {completed: !options.fail, status_str: options.fail ? 'error' : 'success', messages: options.fail ? [['execution_error', {node_id: '60:19', exception_message: 'out of memory'}]] : []},
                        outputs: options.empty
                            ? {}
                            : {
                                    46: {images: Array.from({length: options.batch ?? 1}, (_, i) => ({filename: `${i}.png`, subfolder: '', type: 'output'}))},
                                    999: {images: [{filename: 'unselected.png', subfolder: '', type: 'output'}]},
                                },
                    },
                }));
            } else if(url.pathname === '/comfy/view') {
                assert.notEqual(url.searchParams.get('filename'), 'unselected.png');
                res.setHeader('content-type', options.jpeg ? 'image/jpeg' : 'image/png');
                res.end(downloaded);
            } else { res.statusCode = 404; res.end('{}'); }
        })().catch((error: unknown) => {
            res.statusCode = 500;
            res.end(JSON.stringify({error: String(error)}));
        });
    });
    await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', resolve); });
    t.after(async () => {
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) => {
            server.close((error) => {
                if(error) reject(error);
                else resolve();
            });
        });
        await rm(root, {recursive: true, force: true});
    });
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    await writeFile(path.join(root, 'backend.toml'), `[comfy]\nurl = "http://127.0.0.1:${address.port}/comfy"\n[comfy.auth]\nusername = "user"\npassword = "password"\n`);
    await writeFile(path.join(root, 'workflow.json'), JSON.stringify(workflow));
    const catalogText = 'id = "test"\nname = "Test"\nworkflow = "workflow.json"\n[[variations]]\nname = "CFG"\n[variations.target]\nnode = "60:19"\ninput = "cfg"\n[[variations.values]]\nvalue = 4\nlabel = "Four"\ncategory = "Group"\n[[variations.values]]\nvalue = 5\n';
    await writeFile(path.join(root, 'catalog.toml'), catalogText);
    async function run(...extra: string[]) {
        return await invoke(['-b', path.join(root, 'backend.toml'), path.join(root, 'catalog.toml'), output, '--no-png-optimization', ...extra]);
    }
    return {root, output, prompts, png, run, catalogText};
}

async function invoke(args: string[]) {
    const child = spawn(process.execPath, [executable, ...args], {windowsHide: true});
    let stdout = '', stderr = '';
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    const code = await new Promise<number | null>((resolve, reject) => {
        child.on('error', reject);
        child.on('close', resolve);
    });
    return {code, stdout, stderr};
}

test('help works without configuration or optimizer', async () => {
    const result = await invoke(['--help']);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /--png-quality/);
});

test('generates flat batch outputs and sidecars, then resumes without submission', async (t) => {
    const f = await fixture(t, {batch: 2});
    const result = await f.run('--gen-info');
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual((await readdir(f.output)).sort(), ['0.0.png', '0.1.png', '0.workflow.json', '1.0.png', '1.1.png', '1.workflow.json', 'metadata.json']);
    assert.deepEqual(await readFile(path.join(f.output, '0.0.png')), f.png);
    assert.deepEqual(f.prompts[0], workflow);
    assert.deepEqual(f.prompts[1], {...workflow, '60:19': {class_type: 'Sampler', inputs: {cfg: 5, seed: 42}}});
    assert.equal(await readFile(path.join(f.root, 'workflow.json'), 'utf8'), JSON.stringify(workflow));
    const manifest = await readFile(path.join(f.output, 'metadata.json'), 'utf8');
    assert.match(manifest, /"category": "Group"/);
    assert.match(manifest, /"version": 1/);
    assert.match(manifest, /"output_node": "46"/);
    assert.equal((await f.run('--gen-info')).code, 0);
    assert.equal(f.prompts.length, 2);
    await rm(path.join(f.output, '0.1.png'));
    assert.equal((await f.run('--gen-info')).code, 0);
    assert.equal(f.prompts.length, 3);
});

test('adding gen-info to a resumed run fills missing sidecars', async (t) => {
    const f = await fixture(t);
    assert.equal((await f.run()).code, 0);
    assert.equal((await f.run('--gen-info')).code, 0);
    assert.ok((await readdir(f.output)).includes('0.workflow.json'));
});

test('changed workflow requires force or reset, and force regenerates entries', async (t) => {
    const f = await fixture(t);
    assert.equal((await f.run()).code, 0);
    await writeFile(path.join(f.root, 'workflow.json'), JSON.stringify({...workflow, '60:19': {class_type: 'Sampler', inputs: {cfg: 4, seed: 100}}}));
    const denied = await f.run();
    assert.notEqual(denied.code, 0);
    assert.match(denied.stderr, /fingerprint|changed/i);
    assert.equal(f.prompts.length, 2);
    const forced = await f.run('--force');
    assert.equal(forced.code, 0, forced.stderr);
    assert.equal(f.prompts.length, 4);
});

test('ambiguous output requires a selector; selected node alone is downloaded', async (t) => {
    const f = await fixture(t);
    await writeFile(path.join(f.root, 'workflow.json'), JSON.stringify({...workflow, 999: workflow['46']}));
    const result = await f.run();
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /output_node/);
    assert.equal(f.prompts.length, 0);
    await writeFile(path.join(f.root, 'catalog.toml'), f.catalogText.replace('[[variations]]', 'output_node = "46"\n[[variations]]'));
    const selected = await f.run();
    assert.equal(selected.code, 0, selected.stderr);
});

test('invalid targets fail before reset or submission', async (t) => {
    const f = await fixture(t);
    await f.run();
    await writeFile(path.join(f.root, 'catalog.toml'), f.catalogText.replace('input = "cfg"', 'input = "missing"'));
    const result = await f.run('--reset');
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /missing/);
    assert.equal(f.prompts.length, 2);
    assert.ok((await readdir(f.output)).includes('metadata.json'));
});

for(const mode of ['fail', 'reject', 'empty', 'drop'] as const) {
    test(`${mode} reports failure, does not resubmit, and does not complete an entry`, async (t) => {
        const f = await fixture(t, {[mode]: true});
        const result = await f.run();
        assert.notEqual(result.code, 0);
        assert.equal(f.prompts.length, 1);
        const manifest = JSON.parse(await readFile(path.join(f.output, 'metadata.json'), 'utf8')) as {entries: object};
        assert.deepEqual(manifest.entries, {});
        if(mode === 'fail') assert.match(result.stderr, /60:19.*out of memory|out of memory.*60:19/s);
        if(mode === 'reject') assert.match(result.stderr, /invalid cfg/);
    });
}

test('non-PNG output is converted to PNG even when quantization is disabled', async (t) => {
    const f = await fixture(t, {jpeg: true});
    const result = await f.run();
    assert.equal(result.code, 0, result.stderr);
    const image = await sharp(path.join(f.output, '0.0.png')).metadata();
    assert.equal(image.format, 'png');
    assert.equal(image.width, 16);
    assert.equal(image.height, 16);
});

test('invalid quality options do not submit jobs', async (t) => {
    const f = await fixture(t);
    assert.notEqual((await f.run('--png-quality', '85-95')).code, 0);
    assert.equal(f.prompts.length, 0);
});

test('independent text placeholders form a Cartesian product without replacing inserted text', async (t) => {
    const f = await fixture(t);
    const graph = {...workflow, 11: {class_type: 'Text', inputs: {text: 'quality, {{character}}, {{gesture}}'}}};
    await writeFile(path.join(f.root, 'workflow.json'), JSON.stringify(graph));
    await writeFile(path.join(f.root, 'catalog.toml'), `id = "text"\nname = "Text"\nworkflow = "workflow.json"\n
[[variations]]
name = "Character"
target = {node = "11", input = "text", placeholder = "{{character}}"}
values = [{value = "alpha"}, {value = "literal {{gesture}}"}]
[[variations]]
name = "Gesture"
target = {node = "11", input = "text", placeholder = "{{gesture}}"}
values = [{value = "wave"}, {value = "double v"}]
`);
    const result = await f.run();
    assert.equal(result.code, 0, result.stderr);
    assert.equal(f.prompts.length, 4);
    assert.deepEqual(f.prompts[2]?.['11'], {class_type: 'Text', inputs: {text: 'quality, literal {{gesture}}, wave'}});
    assert.ok((await readdir(f.output)).includes('1-1.0.png'));
});

test('a corrupted metadata image path is rejected before force can touch files', async (t) => {
    const f = await fixture(t);
    await f.run();
    const manifestFile = path.join(f.output, 'metadata.json');
    const text = await readFile(manifestFile, 'utf8');
    await writeFile(manifestFile, text.replace('0.0.png', '../backend.toml'));
    const result = await f.run('--force');
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /metadata/i);
    assert.match(await readFile(path.join(f.root, 'backend.toml'), 'utf8'), /\[comfy\]/);
});

test('missing optimizer fails before reset', async (t) => {
    const f = await fixture(t);
    await f.run();
    const child = spawn(process.execPath, [executable, '-b', path.join(f.root, 'backend.toml'), path.join(f.root, 'catalog.toml'), f.output, '--reset'], {windowsHide: true, env: {...process.env, PATH: ''}});
    let stderr = '';
    child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
    child.stdout.resume();
    const code = await new Promise<number | null>((resolve) => { child.on('close', resolve); });
    assert.notEqual(code, 0);
    assert.match(stderr, /pngquant is unavailable/);
    assert.ok((await readdir(f.output)).includes('0.0.png'));
    assert.equal(f.prompts.length, 2);
});
