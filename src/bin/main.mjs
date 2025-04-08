//@ts-check

/** @import { ProgramArgs } from "./type" */

import fs from "node:fs/promises";
import process from "node:process";

import { ArgumentParser } from 'argparse';
import toml from 'toml';

import { generateCatalog } from "../catalog.mjs";

const parser = new ArgumentParser({
    description: "A tool for creating and updating prompt/checkpoint catalogs for T2I (text-to-image) models on ComfyUI.",
});

parser.add_argument('-b', '--backend', { dest: 'backend_config', help: 'Path to the backend config file.', required: true });
parser.add_argument('--reset', { help: 'Reset the output directory (trivially implies force).', action: 'store_true' });
parser.add_argument('-f', '--force', { help: 'Force to overwrite the output directory.', action: 'store_true' });
parser.add_argument('--gen-info', { dest: 'gen_info', help: 'Generate the generation info file.', action: 'store_true' });

parser.add_argument("catalog_config", { help: "Path to the catalog config file." });
parser.add_argument("output_dir", { help: "Path to the output directory." });

/**
 * @param {ProgramArgs} args 
 */
async function main(args) {
    const backend_config = toml.parse(await fs.readFile(args.backend_config, 'utf-8'));
    const catalog_config = toml.parse(await fs.readFile(args.catalog_config, 'utf-8'));

    await generateCatalog(backend_config, catalog_config, args);
}

main(parser.parse_args()).then(() => {
    process.exit(0);
}).catch((err) => {
    console.error("An error has been occurred!");
    console.error(err);
    process.exit(1);
});
