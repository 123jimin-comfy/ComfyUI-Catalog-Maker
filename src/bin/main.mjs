//@ts-check

/** @import {Config} from "../config"; */

import fs from "node:fs/promises";
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ArgumentParser } from 'argparse';
import toml from 'toml';

import {Client} from "@stable-canvas/comfyui-client";
import { BasicAuthPlugin, generate } from "../comfy-ui/index.mjs";
import { createParameters } from "../config.mjs";

const parser = new ArgumentParser({
    description: "A tool for creating and updating sample images for T2I (text-to-image) models.",
});

parser.add_argument('-c', '--config', {help: "Path to the config file.", required: true});

const subparsers = parser.add_subparsers({dest: 'action', title: "Actions", help: "Which action to do.", required: true});

const parser_render = subparsers.add_parser('render', {help: "Render catalogues."});

async function main(args) {
    console.dir(args);
    
    /** @type {string} */
    const config_path = args.config;
    const config_src = await fs.readFile(config_path, 'utf-8');

    /** @type {Config} */
    const config_obj = toml.parse(config_src);

    switch(args.action) {
        case 'render': {
            await render(config_obj);
            break;
        }
    }
}

main(parser.parse_args());

/**
 * @param {Config} config 
 */
async function render(config) {
    const {comfy: comfy_config, parameters: parameter_configs} = config;
    if(!comfy_config) throw new Error("ComfyUI config must be provided!");
    if(!parameter_configs) throw new Error("Parameter config must be provided!");


    const client = new Client({
        ssl: true,
        api_host: comfy_config.host,
    });

    if(comfy_config.auth?.password) {
        client.use(new BasicAuthPlugin(comfy_config.auth.username, comfy_config.auth.password));
    }

    client.on('connection_error', (err) => {
        console.error(err);
    });

    client.connect();

    const models = await client.getSDModels();

    for(const checkpoint of models) {
        const params = createParameters(parameter_configs, checkpoint);
        if(params.exclude) continue;

        console.log(checkpoint, params);
    }

    // test
    /*
    await generate(client, {
        checkpoint: "sdxl-pony/anime/ArteMix-pony1.safetensors",
        workflow_id: 'sdxl',

        width: 1024, height: 1024,
        prompt: {
            style: [],
            positive: "1girl, looking at viewer, outdoors, casual",
            negative: "",
            loras: [],
        },
        sampler: {
            seed: 0|Math.random()*(2**31),
            steps: 20,
            cfg: 7.5,
            sampler_name: "dpmpp_sde_gpu",
            scheduler: "karras",
            denoise: 1.0,
        },
    })x;
    */
}