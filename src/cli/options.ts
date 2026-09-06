import {ArgumentParser} from 'argparse';
import {type} from 'arktype';

const parsedOptions = type({
    command: "'generate'", backend: 'string', catalog: 'string', output: 'string', force: 'boolean', reset: 'boolean',
    gen_info: 'boolean', no_png_optimization: 'boolean', png_quality: 'string | null',
});
const parsedWebOptions = type({command: "'web'", root: 'string', catalogs: 'string[]'});

export interface WebOptions {command: 'web'; root: string; catalogs: string[]}
export type CommandOptions = (RunOptions & {command: 'generate'}) | WebOptions;

export interface RunOptions {
    backend: string;
    catalog: string;
    output: string;
    force: boolean;
    reset: boolean;
    genInfo: boolean;
    optimize: boolean;
    quality: readonly [number, number];
}

export function parseOptions(args: string[]): CommandOptions {
    const root = new ArgumentParser({prog: 'comfy-catalog', description: 'Generate ComfyUI catalogs and assemble a static catalog website.'});
    const commands = root.add_subparsers({dest: 'command', required: true});
    const parser = commands.add_parser('generate', {help: 'Generate or resume one image catalog.', description: 'Generate an image catalog from a ComfyUI API workflow.'});
    parser.add_argument('-b', '--backend', {required: true, help: 'Backend TOML file.'});
    parser.add_argument('catalog', {help: 'Catalog TOML file; workflow paths are relative to this file.'});
    parser.add_argument('output', {help: 'Flat catalog output directory.'});
    parser.add_argument('-f', '--force', {action: 'store_true', help: 'Regenerate existing entries.'});
    parser.add_argument('--reset', {action: 'store_true', help: 'Delete output contents before generating; implies force.'});
    parser.add_argument('--gen-info', {action: 'store_true', help: 'Save a resolved workflow for each entry.'});
    parser.add_argument('--png-quality', {"default": null, "metavar": 'MIN-MAX', "help": 'pngquant quality range (default: 85-95).'});
    parser.add_argument('--no-png-optimization', {action: 'store_true', help: 'Disable lossy PNG optimization.'});
    const web = commands.add_parser('web', {help: 'Assemble a website using catalog outputs in place.', description: 'Install shared viewer resources and index existing catalogs without copying their output.'});
    web.add_argument('--root', {required: true, help: 'Served site directory, inside or outside the project.'});
    web.add_argument('catalogs', {nargs: '+', metavar: 'METADATA', help: 'Generated metadata files inside the served root, in display order. Paths resolve from the working directory.'});
    const result: unknown = root.parse_args(args);
    if(parsedWebOptions.allows(result)) return result;
    const parsed = parsedOptions.assert(result);
    if(parsed.png_quality !== null && parsed.no_png_optimization) throw new Error('--png-quality and --no-png-optimization cannot be combined');
    const match = /^(\d{1,3})-(\d{1,3})$/.exec(parsed.png_quality ?? '85-95');
    if(!match) throw new Error('--png-quality must be MIN-MAX with integer bounds');
    const min = Number(match[1]), max = Number(match[2]);
    if(min > max || max > 100) throw new Error('--png-quality must satisfy 0 <= MIN <= MAX <= 100');
    return {command: 'generate', backend: parsed.backend, catalog: parsed.catalog, output: parsed.output, force: parsed.force || parsed.reset, reset: parsed.reset, genInfo: parsed.gen_info, optimize: !parsed.no_png_optimization, quality: [min, max]};
}
