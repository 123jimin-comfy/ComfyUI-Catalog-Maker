+++
id = "s0002"
title = "Catalog Configuration"
tags = ["configuration"]
+++

## Observable Behavior

The catalog configuration system specifies how image generation parameters are defined, combined, and mapped to outputs. Configuration is divided into two distinct files by concern:

1. **Backend Configuration (`backend.toml`)**:
   - `[comfy]`: Specifies the ComfyUI endpoint (`url`) and optional HTTP basic authentication credentials (`[comfy.auth] username, password`).
   - `[[parameters]]`: Declares global base parameters and model-specific defaults. A parameter entry may include a glob `pattern` (e.g. `pattern = "sdxl*/**"`) matched against the active checkpoint to conditionally apply settings (such as `pipe`, `width`, `height`, `styles`, `loras`).

2. **Catalog Configuration (`catalog.toml`)**:
   - Identity: Unique `id` and human-readable `name` for the catalog.
   - `[[parameters]]`: Declares catalog-level baseline parameters (e.g., default `prompt`, `checkpoint`, `seed`). May also include pattern-matched overrides.
   - `[[axes]]`: Defines dimensions of variation across the catalog. Each axis specifies:
     - `target`: The parameter key to vary (e.g. `checkpoint`, `prompt`, `cfg`, `steps`, `seed`, `sampler_name`, `scheduler`, `denoise`, `width`, `height`).
     - `name`: Display label for the axis (defaults to `target`).
     - `range`: Defines values for this axis:
       - `float`: Continuous range discretized into `num_steps` segments (`min`, `max`, `num_steps`), producing `num_steps + 1` evenly spaced values.
       - `enum`: Explicit list of scalar values (`string` or `number`) or structured objects with `{ id, label, name, group, value }`.
       - Omitted for `target = "checkpoint"`: Dynamically queries the connected ComfyUI instance to enumerate all available models.

### Parameter Precedence and Resolution

For every point in the Cartesian product of all axes ($A_1 \times A_2 \times \dots \times A_n$):
1. **Built-in Defaults**: Hardcoded fallback values (`width=896`, `height=1152`, `steps=20`, `cfg=7.5`, `sampler_name="dpmpp_sde_gpu"`, `scheduler="karras"`, `denoise=1.0`, `seed=42`).
2. **Backend Global Parameters**: Unconditional entries in `backend.toml`.
3. **Backend Pattern Parameters**: Entries in `backend.toml` matching the active checkpoint path.
4. **Catalog Global Parameters**: Unconditional entries in `catalog.toml`.
5. **Catalog Pattern Parameters**: Entries in `catalog.toml` matching the active checkpoint path.
6. **Axis Coordinate Values**: The specific values assigned to the current combination from `axes`.

### Output Contract

- Each generated image is saved to a deterministic path: `<output_dir>/<checkpoint_slug>/<axis0_id>-<axis1_id>...png`.
- Existing files are skipped by default to allow resumption of interrupted generation runs.
- A `metadata.json` manifest is written to `<output_dir>`, containing catalog identity, resolved axes, discrete value lists (with `id`, `name`, `group`, `value`), and default checkpoint.

## Constraints

- Files must be valid TOML.
- Every catalog must define at least one axis or specify complete baseline generation parameters.
- Axis `target` must correspond to a supported generation parameter.
- `float` ranges must have `num_steps >= 1` and `min <= max`.
- `enum` ranges must contain at least one value.
- Dynamic checkpoint enumeration (`target = "checkpoint"` without `range`) requires a live, responsive ComfyUI backend.
- Generation currently requires the `efficient` pipeline.

## Anticipated Changes

- Support for multiple pipeline types (e.g., standard SD checkpoint, SDXL, Flux, SD3) selected per checkpoint pattern.
- Conditional and dependent axes (e.g., LoRAs or VAE choices conditional on base model architecture).
- Explicit seed generation policies: fixed seed, per-coordinate seed, or randomized batches.
- Dry-run validation mode (`--dry-run`) to verify configuration syntax, query ComfyUI model lists, and output expected image count before execution.
- Export of viewer-compatible catalog bundles (`--gallery`) incorporating the web interface.

## Dangers

- **Combinatorial Explosion**: Multiplying high-cardinality axes can unexpectedly queue thousands of generation tasks and exhaust server resources.
- **Missing Remote Assets**: Checkpoints referenced in catalog or backend configurations that are absent from the ComfyUI server will abort or stall jobs.
- **Pattern Match Ambiguity**: Overlapping glob patterns in parameter blocks may produce unintuitive resolution orders if not strictly ordered.
- **Stale Cache / Output Drift**: Modifying configuration parameters without `--force` or `--reset` can leave previously generated images mismatched with newly generated counterparts under the same metadata manifest.
