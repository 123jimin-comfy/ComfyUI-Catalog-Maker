#!/usr/bin/env node
import {parseOptions} from '../cli/options.ts';

const controller = new AbortController();
const interrupt = () => { controller.abort(new Error('Interrupted; a submitted ComfyUI job may still be running.')); };
process.once('SIGINT', interrupt);
process.once('SIGTERM', interrupt);
try {
    const options = parseOptions(process.argv.slice(2));
    if(options.command === 'web') {
        const {assembleSite} = await import('../web/site.ts');
        await assembleSite(options, controller.signal);
        console.log(`Indexed ${options.catalogs.length} catalogs in ${options.root}`);
    } else {
        const {generateCatalog} = await import('../catalog/generate.ts');
        await generateCatalog(options, controller.signal, (message) => { console.log(message); });
    }
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
} finally {
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
}
