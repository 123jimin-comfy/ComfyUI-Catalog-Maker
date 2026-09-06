import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';

import {Client} from '@stable-canvas/comfyui-client';
import {type} from 'arktype';
import {WebSocket} from 'ws';

import type {BackendConfig} from '../config/schema.ts';
import {type ApiGraph, type NodeDefinitions, nodeDefinitions} from '../workflow/graph.ts';
import {executeWebsocket} from './websocket.ts';

const submission = type({prompt_id: 'string > 0'});
const record = type('Record<string, unknown>');
const historyEntry = type({
    status: {"completed": 'boolean', "status_str": 'string', 'messages?': 'unknown[]'},
    outputs: 'Record<string, unknown>',
});
const nodeImages = type({images: type({filename: 'string', subfolder: 'string', type: 'string'}).array().atLeastLength(1)});

export interface Execution {
    promptId: string;
    images: AsyncIterable<Buffer>;
}

export interface ComfyConnection {
    definitions(): Promise<NodeDefinitions>;
    execute(graph: ApiGraph, outputNode: string): Promise<Execution>;
    close(): void;
}

export function createConnection(backend: BackendConfig, signal: AbortSignal): ComfyConnection {
    const url = new URL(backend.comfy.url);
    const authenticatedFetch: typeof fetch = async (input, init) => {
        const headers = new Headers(init?.headers);
        if(backend.comfy.auth) headers.set('Authorization', `Basic ${Buffer.from(`${backend.comfy.auth.username}:${backend.comfy.auth.password}`).toString('base64')}`);
        const response = await fetch(input, {...init, headers, signal, redirect: 'error'});
        if(!response.ok) throw new Error(`ComfyUI HTTP ${response.status}: ${await response.text()}`);
        return response;
    };
    const clientId = randomUUID();
    const client = new Client({api_host: url.host, api_base: url.pathname.replace(/\/$/, ''), ssl: url.protocol === 'https:', clientId, user: '', fetch: authenticatedFetch, WebSocket});

    return {
        async definitions() { return nodeDefinitions.assert(await client.getNodeDefs()); },
        async execute(graph, outputNode) {
            const submit = async () => {
                try {
                    const queued: unknown = await client.queuePrompt(0, {prompt: graph, workflow: null});
                    return submission.assert(queued).prompt_id;
                } catch (cause) {
                    throw new Error(`ComfyUI submission failed; it will not be resubmitted automatically: ${String(cause)}`, {cause});
                }
            };
            if(graph[outputNode]?.class_type === 'SaveImageWebsocket') {
                const wsUrl = new URL(url);
                wsUrl.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
                wsUrl.pathname = `${url.pathname.replace(/\/$/, '')}/ws`;
                wsUrl.searchParams.set('clientId', clientId);
                const headers: Record<string, string> = {};
                if(backend.comfy.auth) headers['Authorization'] = `Basic ${Buffer.from(`${backend.comfy.auth.username}:${backend.comfy.auth.password}`).toString('base64')}`;
                const result = await executeWebsocket(wsUrl, headers, signal, outputNode, submit);
                return {promptId: result.promptId, images: (async function* () { yield* result.images; })()};
            }
            const promptId = await submit();
            try {
                for(;;) {
                    signal.throwIfAborted();
                    const response = await client.fetchApi(`/history/${encodeURIComponent(promptId)}`);
                    const all = record.assert(await response.json());
                    if(Object.hasOwn(all, promptId)) {
                        const entry = historyEntry.assert(all[promptId]);
                        if(entry.status.status_str === 'error') throw new Error(`Execution failed: ${JSON.stringify(entry.status.messages ?? [])}`);
                        if(entry.status.completed) {
                            if(entry.status.status_str !== 'success') throw new Error(`Unexpected execution status: ${entry.status.status_str}`);
                            const selected = nodeImages(entry.outputs[outputNode]);
                            if(selected instanceof type.errors) throw new Error(`Output node ${outputNode} returned no usable images: ${selected.summary}`);
                            const descriptors = selected.images;
                            async function* download() {
                                try {
                                    for(const descriptor of descriptors) {
                                        const query = new URLSearchParams(descriptor);
                                        const image = await client.fetchApi(`/view?${query.toString()}`);
                                        yield Buffer.from(await image.arrayBuffer());
                                    }
                                } catch (cause) {
                                    throw new Error(`Prompt ${promptId}, output node ${outputNode}: image retrieval failed: ${String(cause)}`, {cause});
                                }
                            }
                            return {promptId, images: download()};
                        }
                    }
                    await delay(500, null, {signal});
                }
            } catch (cause) {
                throw new Error(`Prompt ${promptId}, output node ${outputNode}: ${String(cause)}`, {cause});
            }
        },
        close() { client.disconnect(); },
    };
}
