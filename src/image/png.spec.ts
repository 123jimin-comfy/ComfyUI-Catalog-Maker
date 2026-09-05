import assert from 'node:assert/strict';
import {test, type TestContext} from 'node:test';

import sharp from 'sharp';

import {checkOptimizer, preparePng} from './png.ts';

async function optimizerAvailable(t: TestContext): Promise<boolean> {
    try {
        await checkOptimizer();
        return true;
    } catch{
        t.skip('pngquant is not installed on PATH');
        return false;
    }
}

test('disabled optimization preserves the downloaded PNG bytes', async () => {
    const png = await sharp({create: {width: 12, height: 12, channels: 4, background: '#12345680'}}).png().toBuffer();
    assert.deepEqual(await preparePng(png, {optimize: false, quality: [85, 95]}), png);
});

test('pngquant reduces a compressible image and preserves dimensions and alpha', async (t) => {
    if(!await optimizerAvailable(t)) return;
    const png = await sharp({create: {width: 128, height: 128, channels: 4, background: '#12345680'}}).png({compressionLevel: 0}).toBuffer();
    const optimized = await preparePng(png, {optimize: true, quality: [85, 95]});
    assert.ok(optimized.length < png.length);
    const info = await sharp(optimized).metadata();
    assert.equal(info.width, 128);
    assert.equal(info.height, 128);
    assert.equal(info.hasAlpha, true);
});

test('quality rejection retains original bytes', async (t) => {
    if(!await optimizerAvailable(t)) return;
    const pixels = Buffer.alloc(128 * 128 * 3);
    let state = 123;
    for(let i = 0; i < pixels.length; i++) {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        pixels[i] = state >>> 24;
    }
    const png = await sharp(pixels, {raw: {width: 128, height: 128, channels: 3}}).png().toBuffer();
    assert.deepEqual(await preparePng(png, {optimize: true, quality: [100, 100]}), png);
});

test('corrupt image bytes fail instead of being published as PNG', async () => {
    await assert.rejects(preparePng(Buffer.from('not an image'), {optimize: false, quality: [85, 95]}));
});
