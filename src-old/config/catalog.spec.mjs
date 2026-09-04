import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
    DEFAULT_PARAMETERS,
    getCatalogAxisValues,
    getDefaultCheckpoint,
} from "./index.mjs";

describe("config/catalog", () => {
    describe("getDefaultCheckpoint", () => {
        it("finds checkpoint from unpatterned parameters", () => {
            assert.strictEqual(getDefaultCheckpoint({
                id: "test",
                axes: [],
                parameters: [
                    { pattern: "sdxl/**", checkpoint: "sdxl/model1.safetensors" },
                    { checkpoint: "base.safetensors" },
                ],
            }), "base.safetensors");

            assert.strictEqual(getDefaultCheckpoint({
                id: "test",
                axes: [],
                parameters: [
                    { pattern: "sdxl/**", checkpoint: "sdxl/model1.safetensors" },
                ],
            }), null);

            assert.strictEqual(getDefaultCheckpoint({
                id: "test",
                axes: [],
            }), null);
        });
    });

    describe("getCatalogAxisValues", () => {
        it("handles enum ranges", async () => {
            /** @type {any} */
            const mockClient = {};

            const values = await getCatalogAxisValues(mockClient, {
                target: "steps",
                range: {
                    type: "enum",
                    values: [10, 20, { id: "custom", name: "Custom Step", value: 30 }],
                },
            });

            assert.deepStrictEqual(values, [
                { id: "0", value: 10 },
                { id: "1", value: 20 },
                { id: "custom", name: "Custom Step", value: 30 },
            ]);
        });

        it("handles float ranges", async () => {
            /** @type {any} */
            const mockClient = {};

            const values = await getCatalogAxisValues(mockClient, {
                target: "cfg",
                range: {
                    type: "float",
                    min: 1.0,
                    max: 3.0,
                    num_steps: 2,
                },
            });

            assert.deepStrictEqual(values, [
                { id: "0", value: 1.0 },
                { id: "1", value: 2.0 },
                { id: "2", value: 3.0 },
            ]);
        });

        it("handles checkpoint axis with no range via client.getSDModels", async () => {
            const mockClient = {
                async getSDModels() {
                    return ["sdxl/foo.safetensors", "sdxl/bar.safetensors"];
                },
            };

            /** @type {any} */
            const client = mockClient;

            const values = await getCatalogAxisValues(client, {
                target: "checkpoint",
            });

            assert.deepStrictEqual(values, [
                { id: "0", value: "sdxl/foo.safetensors" },
                { id: "1", value: "sdxl/bar.safetensors" },
            ]);
        });
    });

    describe("DEFAULT_PARAMETERS", () => {
        it("contains standard expected defaults", () => {
            assert.strictEqual(DEFAULT_PARAMETERS.width, 896);
            assert.strictEqual(DEFAULT_PARAMETERS.height, 1152);
            assert.strictEqual(DEFAULT_PARAMETERS.steps, 20);
            assert.strictEqual(DEFAULT_PARAMETERS.cfg, 7.5);
        });
    });
});
