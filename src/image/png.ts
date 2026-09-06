import {spawn} from 'node:child_process';

import sharp from 'sharp';

export interface PngOptions {
    optimize: boolean;
    quality: readonly [number, number];
}

async function runPngquant(args: string[], signal?: AbortSignal, input?: Buffer): Promise<{code: number; stderr: string; stdout: Buffer}> {
    return await new Promise((resolve, reject) => {
        const child = spawn('pngquant', args, {windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], ...(signal ? {signal} : {})});
        const stdout: Buffer[] = [];
        let stderr = '', inputError: Error | null = null;
        child.stdout.on('data', (chunk: Buffer) => { stdout.push(chunk); });
        child.stderr.on('data', (chunk: Buffer) => { stderr = (stderr + chunk.toString()).slice(-8192); });
        // An early exit can close stdin mid-write. Keep the optimizer's failure diagnostic.
        child.stdin.on('error', (error: Error) => { inputError = error; });
        child.on('error', reject);
        child.on('close', (code, killedBy) => {
            if(code === null) reject(new Error(`pngquant interrupted by ${killedBy}`));
            else if(code === 0 && inputError) reject(inputError);
            else resolve({code, stderr, stdout: Buffer.concat(stdout)});
        });
        child.stdin.end(input);
    });
}

export async function checkOptimizer(signal?: AbortSignal): Promise<string> {
    try {
        const result = await runPngquant(['--version'], signal);
        if(result.code !== 0) throw new Error(result.stderr);
        return result.stdout.toString().trim();
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
    // Pipes work even when pngquant and Node have different filesystem views (e.g. private /tmp).
    const result = await runPngquant([`--quality=${options.quality.join('-')}`, '--skip-if-larger', '-'], signal, baseline);
    // Documented pngquant statuses: 98 = not smaller; 99 = below minimum quality.
    if(result.code === 98 || result.code === 99) return baseline;
    if(result.code !== 0) throw new Error(`pngquant failed (${result.code}): ${result.stderr}`);
    const optimized = result.stdout;
    if(optimized.length >= baseline.length) return baseline;
    const info = await sharp(optimized).metadata();
    if(info.format !== 'png' || info.width !== metadata.width || info.height !== metadata.height || (metadata.hasAlpha && !info.hasAlpha)) {
        throw new Error('pngquant changed image dimensions, format, or transparency support');
    }
    return optimized;
}
