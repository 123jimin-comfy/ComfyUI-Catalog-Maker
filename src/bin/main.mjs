//@ts-check

import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ArgumentParser } from 'argparse';
import toml from 'toml';

const parser = new ArgumentParser({
    description: "A tool for creating and updating sample images for T2I (text-to-image) models.",
});

parser.add_argument('-c', '--config', {help: "Path to the config file.", required: true});

async function main(args) {
    /** @type {string} */
    const config_path = args.config;

    console.log(config_path);
}

process.chdir(dirname(fileURLToPath(import.meta.url)));
main(parser.parse_args());