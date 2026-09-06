# ComfyUI Catalog Maker

Generate image catalogs from a user-supplied ComfyUI API workflow. Define variations over node inputs, render each combination sequentially, and save images and metadata in one flat directory.

## Setup

Use Node.js and pnpm with the build/test setup from the TypeScript Node template. Install [pngquant](https://pngquant.org/) on PATH for default lossy PNG optimization. The Windows live test used the official pngquant 2.17.0 binary; the CLI checks availability before generation.

```sh
pnpm install
pnpm build
pnpm start generate -b backend.toml catalog.toml output --gen-info
```

The installed command is `comfy-catalog`, with explicit `generate` and `web` subcommands. This replaces the former `make-comfy-catalog` interface. The CLI runs compiled TypeScript from `dist/`; `src-old/` is not part of the runtime.

## Configuration

Both configuration files use TOML. Workflow files use ComfyUI's **Export (API)** JSON format. The editor's regular JSON export is not executable through this CLI.

Backend configuration contains connection settings only:

```toml
[comfy]
url = "http://127.0.0.1:8188"

# Optional HTTP Basic authentication:
# [comfy.auth]
# username = "..."
# password = "..."
```

A catalog references one workflow. Relative workflow paths resolve from the catalog file's directory. This example uses the sampler node ID from the supplied Anima workflow:

```toml
id = "cfg"
name = "CFG comparison"
workflow = "comfy-workflow-Anima-api.json"

[[variations]]
name = "CFG"
target = { node = "60:19", input = "cfg" }
values = [{ value = 4, label = "Four" }, { value = 5 }]
```

Every variation needs at least one value. Values may include `label` and `category` fields for display and organization. Categories do not add combinations or affect execution. Inputs retain the workflow's values unless an override or variation replaces them.

String candidates support shorthand:

| Shorthand | Equivalent object |
| --- | --- |
| `"V"` | `{ value = "V" }` |
| `"C/V"` | `{ value = "V", category = "C" }` |

A shorthand string containing more than one `/` is an error. Use the object form for literal values containing slashes, labels, or non-string values. Shorthand and object candidates can be mixed in one `values` array. Strings are not trimmed or converted to numbers; empty strings and empty category/value segments remain empty. Metadata stores normalized candidate objects, so switching between equivalent notations does not invalidate resume reuse.

The workflow's sole output node is selected automatically. If several output nodes exist, set a top-level `output_node = "46"` to select one by exact node ID. All images in a batch returned by that node are saved.

### Per-catalog overrides

Add optional `[[overrides]]` entries to set fixed node input values for every catalog entry:

```toml
[[overrides]]
target = { node = "60:19", input = "seed" }
value = 42
```

Each override has a `target` with an exact `node` ID and `input` name, plus one `value`. Targets must already exist; duplicate override targets and incompatible values are rejected before generation. Overrides replace complete input values, including arrays and objects, without deep merging or placeholder substitution.

Application order is **workflow → overrides → variations**. A whole-input variation replaces the overridden value; a placeholder variation uses the overridden text as its baseline. Every entry uses a fresh copy, and the source workflow file remains unchanged. Overrides do not add combinations. Changing overrides requires `--force` or `--reset` when reusing an output directory.

### Character and gesture variations

For two variations inside one prompt, put literal placeholders into the workflow's text input:

```text
masterpiece, best quality, score_7, safe, 1girl, looking at viewer, {{character}}, smiling, {{gesture}}
```

Then declare the corresponding dimensions in the catalog:

```toml
[[variations]]
name = "Character"
target = { node = "60:11", input = "text", placeholder = "{{character}}" }
values = ["hatsune miku"]

[[variations]]
name = "Gesture"
target = { node = "60:11", input = "text", placeholder = "{{gesture}}" }
values = ["double v"]
```

Add candidate values to either dimension to generate their Cartesian product. Placeholders are exact text matches, must exist, and must not overlap. Replacements happen against the baseline text after overrides, so inserted strings are never processed as templates. Without `placeholder`, a variation replaces the entire input.

## Output and resumption

```text
output/
  metadata.json
  0-0.0.png
  0-0.1.png          # If the selected output node returns a second image.
  0-0.workflow.json # With --gen-info.
```

The coordinate contains zero-based candidate indices in variation order. The final numeric suffix is the image's index within the returned batch.

Metadata records the schema version, generation-input fingerprint, catalog identity, selected output node, variation definitions, and completed entries. An entry is complete only after every image and requested workflow sidecar is saved. Rerunning skips complete entries with all files present and retries incomplete ones.

Changed catalog settings or workflow contents require `--force` or `--reset`; changing image optimization options alone does not invalidate existing entries. `--force` regenerates entries. `--reset` deletes the chosen output directory's contents; it refuses to delete input configs or the source workflow. Invalid metadata requires a reset.

Generation logs include the current coordinate's position in the full catalog, named variation positions (one-based), prompt ID, output node, and saved image filenames. Skipped coordinates also count toward progress.

Generation stops on the first failure. Errors include the coordinate and, when available, prompt ID and node details. Submitted prompts are never automatically resubmitted. The CLI polls that prompt's history for file outputs. For `SaveImageWebsocket`, it connects before submission and collects images for the selected output node through execution completion, excluding other nodes' previews. Ctrl+C stops local work but does not cancel the server's job.

## PNG optimization

Downloaded PNGs go through pngquant at quality `65–80`. The optimized image is used only when it satisfies the minimum quality and is smaller; otherwise the original is retained. Dimensions and transparency support are preserved. Other image formats are decoded and encoded as PNG first.

Images are passed to pngquant through stdin/stdout; optimization does not require shared temporary files between Node.js and pngquant.

```sh
pnpm start generate -b backend.toml catalog.toml output --png-quality 75-90
pnpm start generate -b backend.toml catalog.toml output --no-png-optimization
```

The quality range is an optimizer score, not a percentage of perceived fidelity. In the 512×512 live sample, `85–95` retained the original; `75–90` reduced 356,369 bytes to 125,490 bytes with visible dithering. Evaluate the setting for your images. Use `--force` when changing the setting for already completed entries.

## Static catalog website

Generate each catalog directly inside the directory you intend to serve, then index its generated metadata:

```powershell
comfy-catalog generate -b backend.toml catalog-a.toml D:/catalog-site/catalogs/a
comfy-catalog generate -b backend.toml catalog-b.toml D:/catalog-site/catalogs/b
comfy-catalog web --root D:/catalog-site D:/catalog-site/catalogs/a/metadata.json D:/catalog-site/catalogs/b/metadata.json
```

The site root can be anywhere on disk, including outside this project. All CLI paths are absolute or relative to the working directory. Inputs to `web` are generated `metadata.json` files, not catalog TOML configurations. For development, use `pnpm start web ...` or `pnpm start generate ...`.

```text
<site-root>/
  index.html
  assets/
    app.js
    catalog.js
    style.css
  catalogs.json
  catalogs/
    a/
      metadata.json
      0.0.png
      ...
    b/
      metadata.json
      ...
```

`web` installs the shared viewer files and writes an ordered catalog list. It does **not copy or rewrite catalog images, metadata, or workflow sidecars**. Existing unrelated files remain in place. Byte-identical shared files are not rewritten. Rerunning `web` replaces the complete catalog list; omitted catalogs stay on disk. Resume generation in a listed directory and reload the viewer to see completed entries without rerunning `web`. Rerun `web` when changing catalog membership, order, names, or shared viewer resources.

Every input and referenced file must resolve inside the served root. The root's `index.html`, `assets/`, and `catalogs.json` are reserved for the viewer. Generate into a dedicated catalog directory; generation refuses a viewer root containing `catalogs.json`, and `--reset` applies to the selected catalog directory. Keep backend/configuration files and source workflows outside the served root. Generated workflow sidecars inside it are served along with other output files.

Serve the directory using an ordinary static HTTP(S) host. No application backend, ComfyUI connection, frontend build, CDN, or image optimizer is required for website assembly or browsing. Opening the HTML directly with a `file:` URL is unsupported. Relative URLs allow deployment beneath a hosting subdirectory and relocation of the complete site.

The viewer provides a catalog selector and a responsive gallery with all completed entries and batch images, numeric coordinate ordering, variation captions, categories, and full-size image links. Partial and empty catalogs are supported. Images load lazily; large catalogs still create all selected-catalog gallery elements. Matrix views, filtering, comparison tools, and live polling are outside this minimal version.

Shared resources are maintained directly in `static/index.html` and `static/assets/` and included in the npm package. `static/public/` is an optional generated site location, ignored by Git and excluded from packaging. Only the catalog list needs serialization:

```json
{
  "version": 1,
  "catalogs": [
    {"name": "Catalog A", "metadata": "catalogs/a/metadata.json"},
    {"name": "Catalog B", "metadata": "catalogs/b/metadata.json"}
  ]
}
```

## Options and development

Run `pnpm start generate --help` for generation options and `pnpm start web --help` for site assembly options.

```sh
pnpm lint
pnpm build
pnpm test
pnpm build:watch
pnpm clean
```

Tests use Node's built-in runner and a controlled local ComfyUI server; they never contact the configured live backend. Real optimizer tests run when pngquant is on PATH; CI installs it. ArkType owns runtime validation, the existing ComfyUI client is isolated behind an adapter, and Sharp handles image decoding and PNG conversion.

## License

[MIT](LICENSE.md)
