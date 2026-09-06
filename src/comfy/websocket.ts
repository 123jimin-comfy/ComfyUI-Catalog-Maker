import {Client} from '@stable-canvas/comfyui-client';
import {type} from 'arktype';
import {WebSocket} from 'ws';

const eventMessage = type({type: 'string', data: 'Record<string, unknown>'});

// Listen before submitting: a cached/fast prompt can finish before POST /prompt returns.
export async function executeWebsocket(url: URL, headers: Record<string, string>, signal: AbortSignal, outputNode: string, submit: () => Promise<string>): Promise<{promptId: string; images: Buffer[]}> {
    signal.throwIfAborted();
    const socket = new WebSocket(url, {headers, handshakeTimeout: 10000});
    let promptId: string | undefined, executingPrompt: unknown, executingNode: unknown;
    const pending: (() => void)[] = [], images: Promise<Buffer>[] = [];
    let finish!: () => void, fail!: (error: unknown) => void;
    const completed = new Promise<void>((resolve, reject) => {
        finish = resolve; fail = reject;
    });
    // Failure may arrive while the HTTP submission is still pending.
    void completed.catch(() => {});
    const abort = () => {
        fail(signal.reason); socket.terminate();
    };
    signal.addEventListener('abort', abort, {once: true});
    socket.on('error', fail);
    socket.on('close', () => { fail(new Error('ComfyUI websocket closed before execution completed')); });
    socket.on('message', (raw, binary) => {
        const handle = () => {
            try {
                const bytes = Array.isArray(raw) ? Buffer.concat(raw) : Buffer.from(raw as ArrayBuffer);
                if(binary) {
                    if(bytes.length < 4) throw new Error('Truncated ComfyUI binary frame');
                    const kind = bytes.readUInt32BE(0);
                    if(kind === 1) {
                        if(bytes.length < 8) throw new Error('Truncated ComfyUI image frame');
                        if(executingPrompt === promptId && executingNode === outputNode) images.push(Promise.resolve(bytes.subarray(8)));
                    } else if(kind === 4) {
                        const [message] = Client.readBinaryData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
                        if(message.type === 'b_preview_with_metadata' && message.data.promptId === promptId && message.data.nodeId === outputNode) {
                            images.push(message.data.blob.arrayBuffer().then((data) => Buffer.from(data)));
                        }
                    }
                    return;
                }
                const event = eventMessage.assert(JSON.parse(bytes.toString()));
                const data = event.data;
                if(event.type === 'executing') {
                    executingPrompt = data['prompt_id'];
                    executingNode = data['node'];
                }
                if(data['prompt_id'] !== promptId) return;
                if(event.type === 'execution_error' || event.type === 'execution_interrupted') fail(new Error(`${event.type}: ${JSON.stringify(data)}`));
                if(event.type === 'execution_success' || (event.type === 'executing' && data['node'] === null)) finish();
            } catch (error) { fail(error); }
        };
        if(typeof promptId === 'undefined') pending.push(handle);
        else handle();
    });
    try {
        await Promise.race([new Promise<void>((resolve) => { socket.once('open', resolve); }), completed]);
        signal.throwIfAborted();
        promptId = await submit();
        for(const handle of pending) handle();
        pending.length = 0;
        await completed;
        const result = await Promise.all(images);
        if(result.length === 0) throw new Error(`Output node ${outputNode} returned no websocket images`);
        return {promptId, images: result};
    } catch (cause) {
        throw new Error(`Prompt ${promptId ?? '(not submitted)'}, output node ${outputNode}: ${String(cause)}`, {cause});
    } finally {
        signal.removeEventListener('abort', abort);
        socket.terminate();
    }
}
