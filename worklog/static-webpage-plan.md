# Static catalog webpage proposal

This document records the design approved for implementation in t0002. The user permits breaking existing CLI/data compatibility and wants to minimize copies by generating catalogs directly inside the static site directory. Current implemented behavior is authoritative in s0001 and s0005; implementation and validation evidence are recorded in worklog/archive/task/t0002-static-catalog-webpage.md. Optional future extensions below remain proposals.

## Findings

- The current executable is `make-comfy-catalog`, with backend configuration required and two positional arguments: catalog TOML and output directory. A catalog TOML does not record the output directory.
- Generated `metadata.json` already provides the catalog ID/name, ordered variations, labels/categories, coordinates, and explicit image filenames, including multiple images per entry. No new per-catalog format is necessary.
- `static/` already separates common resources from a fetched catalog list, but its viewer expects legacy `axes`/`checkpoint` metadata and constructs legacy image paths. It cannot browse current output unchanged.
- `local/experiment` demonstrates visual layouts using hardcoded catalogs and placeholder images. Its descriptions, badges, comparison features, and special cases are not requirements.
- The npm package currently includes `dist` only. Root-level web resources would be missing from an installed package unless explicitly included.

## Proposed CLI

Replace the existing executable interface with explicit subcommands (proposed executable name: `comfy-catalog`):

```sh
comfy-catalog generate -b backend.toml catalog-a.toml public/catalogs/a
comfy-catalog generate -b backend.toml catalog-b.toml public/catalogs/b
comfy-catalog web --root public public/catalogs/a/metadata.json public/catalogs/b/metadata.json
```

The served root is an arbitrary caller-selected directory, inside or outside the project. `--root` and generation output arguments accept absolute paths or paths relative to the working directory. There is no required relationship between the served root and the repository or installed package. For example:

```powershell
comfy-catalog generate -b backend.toml catalog-a.toml D:/catalog-site/catalogs/a
comfy-catalog generate -b backend.toml catalog-b.toml D:/catalog-site/catalogs/b
comfy-catalog web --root D:/catalog-site D:/catalog-site/catalogs/a/metadata.json D:/catalog-site/catalogs/b/metadata.json
```

Catalog containment means containment within the selected served root, not within the project. The generated list contains relative URLs rather than absolute filesystem paths, so the assembled site can be relocated as a unit.

Here “catalog files” means generated metadata files. This is an explicit proposal: if inputs instead mean catalog TOML configurations, the interface also needs an explicit mapping to result directories; the current configuration cannot supply that information.

- `generate` retains the generation options under its subcommand. `web` accepts one or more metadata paths, in display order, and requires `--root DIR`.
- Resolve CLI paths from the working directory and image/sidecar paths from each metadata file's directory.
- Take display names from metadata. Preserve caller-chosen directories; never derive paths from arbitrary catalog IDs. Metadata URLs distinguish catalogs even when IDs/names repeat. Reject duplicate resolved metadata paths.
- `web` installs common resources and writes the catalog list, referencing existing outputs in place. It never copies, moves, links, rewrites, or regenerates catalog output. Require all referenced catalogs to be inside the served root; outside-root inputs get a clear error, with no implicit copy fallback.
- Validate all inputs before writing: schema/version, coordinate and filename consistency, referenced regular files, and resolved containment within the served root, including symlink targets. Extract the existing pure entry validator from `src/catalog/files.ts` into a shared metadata validation boundary; do not use generation's `prepareOutput`, which has write/reset semantics.
- Permit an already populated root. Reserve `index.html`, `assets/`, and `catalogs.json` for the viewer; reject catalogs overlapping those paths. Update known common files only if their bytes differ; atomically replace the list after validation and successful asset writes. Reject incompatible filesystem entries rather than deleting them. No recursive site reset and no deleting catalogs omitted from the new list. Atomic replacement of the entire website is outside the minimal command's scope.
- Return useful errors and a nonzero exit status on failure. Neither ComfyUI connectivity nor pngquant is required for `web`; isolate generation dependencies from that command's startup path.

No legacy argument autodetection or compatibility alias is needed. Reuse argparse subparsers. The generation command remains independent of site membership: it writes one catalog; the web command declares the complete ordered list of catalogs to show. Rerun `web` to add/remove/reorder catalogs or refresh list names; resuming generation in an already listed directory only changes that catalog's output. Reloading the viewer reads the current metadata, subject to ordinary hosting cache policy; live polling is not included.

For the desired `static/public` layout, replace `public` with `static/public` in every example. Keep configurations and source workflows outside the public root. Use a dedicated directory per catalog: `generate --reset` applies only to that directory, never to the whole site. Reject generation into an identifiable viewer root (containing the viewer's index/list) before any destructive preparation, and document the directory boundary.

An optional `--catalog-list FILE` input can come later if long command lines become inconvenient. The minimal CLI already takes a list as positional arguments; no second input-file schema is needed initially.

## Assembly contract

```text
public/
  index.html                    # copied common resource
  assets/
    app.js                      # copied common resource
    catalog.js                  # copied common resource
    style.css                   # copied common resource
  catalogs.json                 # generated list
  catalogs/
    a/
      metadata.json             # unchanged catalog output
      0-0.0.png
      0-0.1.png
      0-0.workflow.json         # when referenced
    b/
      metadata.json
      ...
```

Proposed list format (illustrative names):

```json
{
  "version": 1,
  "catalogs": [
    { "name": "Catalog A", "metadata": "catalogs/a/metadata.json" },
    { "name": "Catalog B", "metadata": "catalogs/b/metadata.json" }
  ]
}
```

The list's names populate the selector without fetching all catalog metadata. Metadata remains authoritative once a catalog loads. Each metadata URL is relative to the list URL; each image URL is relative to its metadata URL. Use URL resolution and relative asset references so the whole site also works beneath a hosting subdirectory.

Only `catalogs.json` needs serialization. Shared files are independent of which catalogs exist; individual outputs need no templating or transformation. A person or another tool can assemble the same layout, update the list, or replace a catalog's outputs without rebuilding the common site. Output URLs remain stable while caller-chosen directories remain stable. No persistent catalog selection or deep-link UI is required for the first version. Encode filesystem path segments into relative URLs; never serialize Windows backslashes or unescaped URL delimiters.

Proposed hosting contract: ordinary static HTTP(S), without an application backend. Opening `index.html` by double-click is a separate requirement: local `file:` loading has restrictions on modules and fetched JSON ([MDN modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules), [MDN local-file CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS/Errors/CORSRequestNotHttp)). If double-click operation is required, revisit the data-loading contract before implementation; do not silently promise it with this JSON-fetch design.

## Including common resources

Use the existing root `static/` as canonical browser source, replacing its legacy viewer with `static/index.html` and `static/assets/`. Keep `local/experiment` as a reference. Extract visual ideas selectively, without shipping its sample data or unused controls. The assembled output directory is independently selected by `--root`; `static/public/` is only an optional in-project example and must never be treated as a source resource. Reject a served root that overlaps the canonical common-resource source files, so assembly cannot overwrite its own inputs.

- Author plain HTML, CSS, and browser-native JavaScript modules; optional JSDoc supports development without producing browser bundles.
- Add only `static/index.html` and `static/assets` to the package `files` allowlist alongside `dist`. Do not package or recursively copy all of `static/`, which could include generated `static/public/` images. Ignore generated public output in Git; keep test fixtures elsewhere.
- Resolve resources relative to the installed web-command module, using a module-relative URL, never the caller's current directory. With the proposed `dist/web/site.js` layout, the package resource root is `../../static/`. Copy only the explicit common-resource paths.
- Keep the existing TypeScript build for the Node CLI. Do not add a frontend compilation, bundling, template rendering, CDN, font download, or asset-generation step.
- Keep browser code independent of Node imports and generation dependencies. A small pure catalog interpretation module can be exercised with Node tests without importing DOM code.

## Data without compatibility constraints

Implement one current data contract and reject unsupported versions, without legacy `axes`/`checkpoint` adapters or filename guessing. The current generated metadata already supplies what the minimal viewer needs, so breaking compatibility is an available tool, not a reason to redesign useful fields.

For category data specifically, keep normalized candidates with `value`, optional `label`, and optional `category`. Category is a display/grouping attribute; array position identifies a candidate, preserving duplicate values/labels and generation coordinates. Do not adopt the prototype's nested group objects, decorative fields, or hardcoded dimensional cases. The existing TOML category shorthand need not change to support this feature; any separate shorthand redesign should be proposed explicitly.

Keep the site list small (name and metadata URL) and catalog metadata authoritative. No new transformed viewer dataset or second per-catalog file is required. A public-metadata/resume-state split can be considered later if there is a concrete need, rather than adding synchronization work to the minimal implementation.

## Minimal working example

One page with a labeled catalog selector, catalog title, and a responsive gallery of completed entries:

1. Load the catalog list; select its first item and load only that catalog's metadata. Display loading and readable error states. Support an empty manually assembled list.
2. Sort entries by numeric coordinate in variation order. Each entry displays all images in their recorded batch order, preserving aspect ratios. Lazy-load images and link each to its original PNG for full-size viewing.
3. Caption entries with every selected variation value: prefer its provided label, otherwise display its value as text (serialize structured values). Show a provided category as text. Use coordinate and image index to distinguish duplicate labels.
4. Treat missing coordinates as ungenerated results, not inferred image URLs. Show completed/total combination counts and a clear empty-catalog state. An interrupted generation's valid partial catalog remains browsable.
5. On catalog changes, clear the previous result and ignore or cancel stale loads. Render catalog text through text nodes, and show broken-image errors without disabling the selector.

This single gallery works for any number of variations; the first version does not require separate 1D, 2D, and 3D rendering paths. It will not provide the prototype's matrix, axis reassignment, slicing/filtering, comparison dock, inspector modal, shortcuts, picks, search, or generated descriptions. Axis-based comparison can be proposed independently after the assembly and data-loading contract works.

Minimal gallery tradeoff: lazy image loading reduces immediate image downloads, but all selected-catalog metadata and gallery elements still load into memory. Large-catalog pagination/virtualization and generated thumbnails are later work unless actual catalog sizes make them necessary for the first release.

## Implementation sequence and acceptance

1. After design agreement, record approved viewer/assembly behavior in s0005 and the replacement CLI in s0001, with unimplemented markers. Preserve proposals as proposals.
2. Add command tests for the agreed behavior; share existing metadata validation; implement subcommand routing, in-place assembly, and package resource inclusion.
3. Replace the legacy common viewer with the minimal gallery and selected prototype styling. Keep data loading, catalog interpretation, and DOM rendering separate.
4. Verify a small fixture set: two selectable catalogs; one and several dimensions; several images at one coordinate; repeated labels/IDs; categorized/structured values; partial and empty catalogs; invalid metadata; missing referenced files; unsafe destinations; and stale catalog loads.
5. Pack/install in a temporary location and run `web` from an unrelated working directory, targeting a served root outside the project and installed package. Also cover the optional in-project layout. Confirm that only common static resources ship, `static/public/` is excluded, catalog files and modification times remain unchanged, and unchanged common files are not rewritten on reruns. Verify exact list replacement without deletion of omitted catalogs; outside-root and symlink-escape rejection; common-resource source overlap rejection; encoded relative URLs; generation reset confined to a catalog; and viewer-root generation refusal.
6. Serve the assembled site at both a root URL and a nested path. Check switching catalogs, every image in a batch, full-size links, readable errors, and narrow-screen layout in a browser. Resume generation under the public directory and verify the additional completed entry after reload without rerunning `web`. No network request should target ComfyUI or a third-party asset host.

Implementation and test results are recorded in the archived t0002 task.
