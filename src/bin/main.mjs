//@ts-check

/** @import {Config} from "../config"; */

import fs from "node:fs/promises";
import process from "node:process";

import { ArgumentParser } from 'argparse';
import toml from 'toml';

import { render } from "../render.mjs";
import { createIndex } from "../create-index.mjs";

const parser = new ArgumentParser({
    description: "A tool for creating and updating sample images for T2I (text-to-image) models.",
});

const subparsers = parser.add_subparsers({dest: 'action', title: "Actions", help: "Which action to do.", required: true});

const parser_render = subparsers.add_parser('render', {help: "Render catalogues."});
parser_render.add_argument('-c', '--config', {help: "Path to the config file.", required: true});
parser_render.add_argument('-f', '--force', {help: "Force re-rendering of images.", action: 'store_true', default: false});
parser_render.add_argument('-o', '--output', {help: "Path to the render output directory.", default: "render"});

const parser_create_index = subparsers.add_parser('create-index', {help: "Create index for the catalogues."});
parser_create_index.add_argument('-c', '--config', {help: "Path to the config file.", required: true});
parser_create_index.add_argument('-o', '--output', {help: "Path to the output file path.", default: "catalog.json"});

async function main(args) {
    console.dir(args);

    /**
     * @param {{config: string}} args 
     * @returns {Promise<Config>}
     */
    const getConfig = async (args) => {
        /** @type {string} */
        const config_path = args.config;
        const config_src = await fs.readFile(config_path, 'utf-8');
    
        return toml.parse(config_src);
    };
    

    switch(args.action) {
        case 'render': {
            await render(await getConfig(args), args.output, args.force);
            break;
        }
        case 'create-index': {
            await createIndex(await getConfig(args), args.output);
            break;
        }
    }

    process.exit(0);
}

main(parser.parse_args());
