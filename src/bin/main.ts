#!/usr/bin/env node
import {generateCatalog} from '../catalog/generate.ts';
import {parseOptions} from '../cli/options.ts';

const controller = new AbortController();
const interrupt = () => { controller.abort(new Error('Interrupted; a submitted ComfyUI job may still be running.')); };
process.once('SIGINT', interrupt);
process.once('SIGTERM', interrupt);
try {
    await generateCatalog(parseOptions(process.argv.slice(2)), controller.signal, (message) => { console.log(message); });
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
} finally {
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
}
