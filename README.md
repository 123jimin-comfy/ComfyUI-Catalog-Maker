# ComfyUI Catalog Maker

Generate comparable image catalogs with ComfyUI. Define the generation defaults once, choose the parameters to vary, and render every combination into a structured output directory.

Useful for:

- comparing checkpoints with the same prompt and settings;
- testing prompt or sampler variations;
- building grids across parameters such as CFG and steps.

## Quick start

Requirements: Node.js, pnpm, and a reachable ComfyUI server with the required checkpoints installed.

```bash
pnpm install
pnpm start -- -b backend.toml catalog.toml output
```

If the package is installed as a command, the equivalent invocation is:

```bash
make-comfy-catalog -b backend.toml catalog.toml output
```

The command writes generated PNG files and `metadata.json` under `output`. Existing images are skipped by default, so rerunning the same catalog resumes incomplete work.

## Configuration

Configuration is split by responsibility:

- `backend.toml` defines the ComfyUI connection and reusable generation defaults.
- `catalog.toml` defines one catalog and the axes that vary.

Values are resolved in this order: built-in defaults, backend parameters, catalog parameters, then axis values.

### `backend.toml`

```toml
[comfy]
url = "http://127.0.0.1:8188"

# Optional HTTP Basic authentication
[comfy.auth]
username = "user"
password = "password"

[[parameters]]
# Applied to every checkpoint
width = 896
height = 1152

[[parameters]]
# Applied only to matching checkpoints
pattern = "sdxl*/**"
pipe = "efficient"
styles = ["SDXL"]
```

### `catalog.toml`

This example varies CFG and steps for one checkpoint and prompt:

```toml
id = "cfg_steps"
name = "CFG × Steps"

[[parameters]]
checkpoint = "sdxl/foo.safetensors"
prompt = "1girl, solo, outdoors, casual, looking at viewer, full body"

[[axes]]
name = "CFG"
target = "cfg"

[axes.range]
type = "float"
min = 1.0
max = 20.0
num_steps = 19

[[axes]]
name = "Steps"
target = "steps"

[axes.range]
type = "enum"
values = [1, 2, 4, 8, 16, 32, 64]
```

Each combination of axis values produces one image. Common axis targets include `checkpoint`, `prompt`, `cfg`, `steps`, `seed`, `width`, `height`, `sampler_name`, `scheduler`, and `denoise`.

An axis with `target = "checkpoint"` may omit its range to use every checkpoint reported by ComfyUI.

## Command options

```text
-b, --backend PATH  Backend configuration file (required)
-f, --force         Regenerate existing images
    --reset         Delete the output directory before generating
    --gen-info      Write generation parameters beside each image
```

`--reset` removes the selected output directory before work begins. Use it carefully.

## Current limitation

Only the `efficient` generation pipe is supported.

## Proposed improvements

These are not implemented yet:

- `--dry-run`: validate both configs and report the number of images before starting.
- `--jobs <count>`: render multiple independent combinations concurrently with a safe default of one.
- `--gallery`: copy the existing static viewer and generate its catalog index, producing a browsable result without manual setup.

## License

[MIT](LICENSE.md)
