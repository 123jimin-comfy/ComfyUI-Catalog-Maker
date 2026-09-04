import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
    advanceIndices,
    addCheckpointExtension,
    createFilenamePrefix,
    fileExists,
    getImagePath,
    toFileName,
} from "./util.mjs";

describe("util", () => {
    describe("createFilenamePrefix", () => {
        it("creates valid YYYY-MM-DD prefix with 1-based month", () => {
            const prefix = createFilenamePrefix();
            const regex = /^catalog-\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
            assert.match(prefix, regex);

            const now = new Date();
            const expectedMonth = (now.getMonth() + 1).toString().padStart(2, "0");
            assert.ok(prefix.includes(`-${expectedMonth}-`));
        });
    });

    describe("addCheckpointExtension", () => {
        it("appends .safetensors if missing", () => {
            assert.strictEqual(addCheckpointExtension("model"), "model.safetensors");
            assert.strictEqual(addCheckpointExtension("model.safetensors"), "model.safetensors");
            assert.strictEqual(addCheckpointExtension("model.ckpt"), "model.ckpt");
            assert.strictEqual(addCheckpointExtension("path/to/model.CKPT"), "path/to/model.CKPT");
        });
    });

    describe("toFileName", () => {
        it("sanitizes path and strips extension", () => {
            assert.strictEqual(toFileName("sdxl/model.safetensors"), "sdxl_model");
            assert.strictEqual(toFileName("My Model (v1.0).safetensors"), "my-model-v1-0-");
            assert.strictEqual(toFileName("a/b/c"), "a_b_c");
        });
    });

    describe("getImagePath", () => {
        it("formats image directory and filename", () => {
            assert.deepStrictEqual(getImagePath([], "sdxl/model.safetensors"), ["sdxl_model", "image"]);
            assert.deepStrictEqual(getImagePath(["0", "1"], "sdxl/model.safetensors"), ["sdxl_model", "0_1"]);
        });
    });

    describe("advanceIndices", () => {
        it("advances odometer correctly across dimensions", () => {
            const lens = [2, 3];
            const indices = [0, 0];

            const visited = [];
            do {
                visited.push(indices.slice());
            } while (advanceIndices(lens, indices));

            assert.deepStrictEqual(visited, [
                [0, 0],
                [0, 1],
                [0, 2],
                [1, 0],
                [1, 1],
                [1, 2],
            ]);
            assert.deepStrictEqual(indices, [0, 0]);
        });
    });

    describe("fileExists", () => {
        it("checks file existence accurately", async () => {
            assert.strictEqual(await fileExists("package.json"), true);
            assert.strictEqual(await fileExists("non-existent-file-xyz.abc"), false);
        });
    });
});
