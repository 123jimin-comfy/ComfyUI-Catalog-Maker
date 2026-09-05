import {spawn} from 'node:child_process';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

import sharp from 'sharp';

export interface PngOptions {
    optimize: boolean;
    quality: readonly [number, number];
}

async function runPngquant(args: string[], signal?: AbortSignal): Promise<{code: number; stderr: string; stdout: string}> {
    return await new Promise((resolve, reject) => {
        const child = spawn('pngquant', args, {windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], ...(signal ? {signal} : {})});
        let stdout = '', stderr = '';
        child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
        child.stderr.on('data', (chunk: Buffer) => { stderr = (stderr + chunk.toString()).slice(-8192); });
        child.on('error', reject);
        child.on('close', (code, killedBy) => {
            if(code === null) reject(new Error(`pngquant interrupted by ${killedBy}`));
            else resolve({code, stderr, stdout});
        });
    });
}

export async function checkOptimizer(signal?: AbortSignal): Promise<string> {
    try {
        const result = await runPngquant(['--version'], signal);
        if(result.code !== 0) throw new Error(result.stderr);
        return result.stdout.trim();
    } catch (cause) {
        throw new Error('pngquant is unavailable. Install pngquant on PATH or use --no-png-optimization.', {cause});
    }
}

export async function preparePng(source: Buffer, options: PngOptions, signal?: AbortSignal): Promise<Buffer> {
    signal?.throwIfAborted();
    const metadata = await sharp(source).metadata();
    if((metadata.pages ?? 1) > 1) throw new Error('Animated/multipage images are not supported as a catalog image');
    const baseline = metadata.format === 'png' ? source : await sharp(source).png().toBuffer();
    if(!options.optimize) return baseline;
    const temp = await mkdtemp(path.join(tmpdir(), 'catalog-png-'));
    try {
        const input = path.join(temp, 'input.png'), output = path.join(temp, 'output.png');
        await writeFile(input, baseline);
        const result = await runPngquant([`--quality=${options.quality.join('-')}`, '--skip-if-larger', '--output', output, '--', input], signal);
        // Documented pngquant statuses: 98 = not smaller; 99 = below minimum quality.
        if(result.code === 98 || result.code === 99) return baseline;
        if(result.code !== 0) throw new Error(`pngquant failed (${result.code}): ${result.stderr}`);
        const optimized = await readFile(output);
        if(optimized.length >= baseline.length) return baseline;
        const info = await sharp(optimized).metadata();
        if(info.format !== 'png' || info.width !== metadata.width || info.height !== metadata.height || (metadata.hasAlpha && !info.hasAlpha)) {
            throw new Error('pngquant changed image dimensions, format, or transparency support');
        }
        return optimized;
    } finally { await rm(temp, {recursive: true, force: true}); }
}
