import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {test} from 'node:test';

import {WebSocketServer} from 'ws';

import {createConnection} from './client.ts';

for(const outcome of ['success', 'error', 'interrupted', 'close', 'empty', 'abort'] as const) {
    test(`websocket output: ${outcome}`, async (t) => {
        const server = createServer();
        const wss = new WebSocketServer({server, path: '/comfy/ws'});
        const controller = new AbortController();
        const auth = `Basic ${Buffer.from('user:password').toString('base64')}`;
        let clientId: string | null = null, submissions = 0;
        wss.on('connection', (_socket, req) => {
            assert.equal(req.headers.authorization, auth);
            clientId = new URL(req.url!, 'http://localhost').searchParams.get('clientId');
        });
        server.on('request', (req, res) => {
            void (async () => {
                assert.equal(new URL(req.url!, 'http://localhost').pathname, '/comfy/prompt');
                assert.equal(req.headers.authorization, auth);
                let body = '';
                for await (const chunk of req) body += String(chunk);
                const submitted = JSON.parse(body) as {client_id: string};
                assert.ok(clientId);
                assert.equal(submitted.client_id, clientId);
                submissions++;
                const socket = [...wss.clients][0]!;
                const event = (type: string, data: object) => { socket.send(JSON.stringify({type, data})); };
                const executing = (prompt_id: string, node: string) => { event('executing', {prompt_id, node}); };
                const image = (text: string) => {
                    const header = Buffer.alloc(8);
                    header.writeUInt32BE(1, 0);
                    header.writeUInt32BE(2, 4);
                    socket.send(Buffer.concat([header, Buffer.from(text)]));
                };
                // All events precede the HTTP response, exercising the submission race.
                executing('other', '2'); image('other prompt');
                executing('job', '1'); image('sampler preview');
                executing('job', '3'); image('other output');
                executing('job', '2');
                if(outcome === 'success') {
                    image('first');
                    const metadata = Buffer.from(JSON.stringify({prompt_id: 'job', node_id: '2', image_type: 'image/png'}));
                    const header = Buffer.alloc(8);
                    header.writeUInt32BE(4, 0);
                    header.writeUInt32BE(metadata.length, 4);
                    socket.send(Buffer.concat([header, metadata, Buffer.from('second')]));
                }
                if(outcome === 'close') socket.close();
                else if(outcome === 'abort') controller.abort(new Error('test cancellation'));
                else if(outcome === 'error' || outcome === 'interrupted') event(`execution_${outcome}`, {prompt_id: 'job', exception_message: 'test failure'});
                else event('execution_success', {prompt_id: 'job'});
                res.setHeader('content-type', 'application/json');
                res.end(JSON.stringify({prompt_id: 'job'}));
            })().catch((error: unknown) => { res.statusCode = 500; res.end(String(error)); });
        });
        await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', resolve); });
        t.after(async () => {
            for(const socket of wss.clients) socket.terminate();
            await new Promise<void>((resolve) => {
                wss.close(() => { resolve(); });
            });
            server.closeAllConnections();
            await new Promise<void>((resolve) => {
                server.close(() => { resolve(); });
            });
        });
        const address = server.address();
        assert.ok(address && typeof address === 'object');
        const connection = createConnection({comfy: {url: `http://127.0.0.1:${address.port}/comfy`, auth: {username: 'user', password: 'password'}}}, controller.signal);
        t.after(() => { connection.close(); });
        const execution = connection.execute({2: {class_type: 'SaveImageWebsocket', inputs: {}}}, '2');
        if(outcome === 'success') {
            const result = await execution;
            assert.equal(result.promptId, 'job');
            const images = [];
            for await (const image of result.images) images.push(image.toString());
            assert.deepEqual(images, ['first', 'second']);
        } else {
            const expected = {error: /execution_error/, interrupted: /execution_interrupted/, close: /websocket closed/, empty: /no websocket images/, abort: /test cancellation/};
            await assert.rejects(execution, expected[outcome]);
        }
        assert.equal(submissions, 1);
    });
}
