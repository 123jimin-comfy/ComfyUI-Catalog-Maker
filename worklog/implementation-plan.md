# TypeScript Implementation Plan

This plan covers s0001–s0004. Their observable behavior remains authoritative, including flat output filenames with image indices. Implementation is tracked in t0001. The accepted policies are recorded in s0001–s0004.

## TypeScript Baseline

Use `C:/Users/pjm95/GitHub/template.typescript.node/` as the reference for build, lint, and test configuration:

- TypeScript source under `src/`, compiled ESM under `dist/`, with `module: NodeNext`.
- Retain strict checking, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`, `noImplicitOverride`, and `noPropertyAccessFromIndexSignature`.
- Retain source maps, declaration output, `.ts` source imports with `rewriteRelativeImportExtensions`, and `erasableSyntaxOnly`. Omit the template's unused JSX setting.
- Use `tsc` for build/watch and Node's built-in test runner for compiled, colocated `*.spec.ts` tests. Reuse the template's ESLint configuration and import sorting.
- Point the CLI binary at `dist/bin/main.js`; keep a shebang. Build before tests and packaging; exclude compiled tests from the package.
- Select an explicit supported Node runtime before setting `engines`, compiler target/lib, `@types/node`, and CI. The template's `ESNext`, Node types version, and floating `lts/*` are not evidence of this project's runtime support.
- Use the project's pnpm lockfile and release-age policy. Do not run the template bootstrap or copy its package identity, license, or lockfile wholesale.

## Dependencies to Download

### Additional Runtime Dependencies

| Dependency | Purpose | Integration |
| --- | --- | --- |
| `arktype` | Validate configuration, workflow envelopes, persisted metadata, and consumed server responses. Infer configuration types from schemas to avoid parallel validators and interfaces. | Boundary validation only; preserve workflow fields not interpreted by this application. |
| `sharp` | Decode non-PNG image outputs and encode the PNG baseline required by s0004. | Image module only; existing PNG bytes bypass re-encoding. It does not replace pngquant. |
| `pngquant` executable | The lossy PNG optimization required by s0004. | External binary available on PATH, invoked through Node's child-process API. |

[ArkType supports runtime parsing and inferred TypeScript types](https://arktype.io/docs/intro/your-first-type). [Sharp provides platform-specific prebuilt dependencies, including Windows x64](https://sharp.pixelplumbing.com/install/); allow its required optional packages during installation. [pngquant provides quality thresholds and platform downloads](https://pngquant.org/). Record the tested binary version and installation instructions; do not introduce an npm binary-download wrapper or custom image quantizer.

Choose and lock compatible exact versions of the new packages during toolchain setup; no unverified “latest” version is prescribed here.

### Additional Development Dependencies

The following versions are observed in the reference project's lockfile, not claimed to be latest releases. Use them as the starting toolchain and verify runtime and peer compatibility before installation.

| Dependency | Reference version / selection |
| --- | --- |
| `typescript` | `6.0.3` |
| `@types/node` | Reference has `26.4.1`; align with the selected supported Node runtime. |
| `eslint` | `10.9.1` |
| `@eslint/js` | `10.0.1` |
| `@jiminp/eslint-config` | `1.3.7` |
| `typescript-eslint` | `8.62.1` |
| `@stylistic/eslint-plugin` | `5.10.0` |
| `eslint-plugin-simple-import-sort` | `13.0.0` |
| `rimraf` | `6.1.3`, for the template's cross-platform clean command. |
| `@types/ws` | Compatible with retained `ws` 8.x. |

No additional test runner, TypeScript runtime loader, bundler, dependency-injection framework, or HTTP client is needed.

### Existing Dependencies

| Dependency | Plan |
| --- | --- |
| `@stable-canvas/comfyui-client` `1.5.9` | Retain behind the ComfyUI adapter. Installed declarations expose node definitions, prompt submission, status, outputs, and connection cleanup. Verify behavior with adapter contract tests before relying on convenience methods. |
| `ws` `8.21.3` | Retain for the client's Node WebSocket transport and authentication support. |
| `argparse` `3.0.1` | Retain the existing CLI parser; the installed package includes TypeScript declarations. |
| `toml` `5.0.0` | Retain if TOML is confirmed as the configuration format; it includes declarations. Serialization is still open in s0002. |
| `@jiminp/comfy-box` | Remove from the new runtime: its pipeline creation and preset/default resolution do not belong in the supplied-workflow model. |

Keep new code independent of `src-old/`; consult it for established behavior, not as a runtime dependency. Do not upgrade retained libraries merely as part of the language migration.

## Code Architecture

Use a single package with small modules grouped by responsibility:

```text
src/
  bin/main.ts                  CLI composition, reporting, exit status
  cli/options.ts               Argument parsing and option validation
  config/schema.ts             Config schemas and inferred types (s0002)
  config/load.ts               File loading and path resolution
  workflow/graph.ts            API graph validation and output selection
  workflow/variations.ts       Lazy coordinates and fresh-copy input replacement
  comfy/client.ts              ComfyUI SDK adapter and authentication (s0003)
  image/png.ts                 PNG normalization and pngquant execution
  catalog/generate.ts          Generation orchestration (s0004)
  catalog/metadata.ts          Persisted schema and typed metadata construction
  catalog/files.ts             Flat filenames, file publication, completion checks
```

Tests live beside the modules they exercise. Split a module further only when it gains a distinct responsibility; do not create generic service/repository layers or a plugin framework.

The dependency direction is `CLI -> generation -> graph operations / ComfyUI / image processing / catalog files`. Graph and coordinate functions perform no network, filesystem, or process I/O. Adapters do not import the CLI or orchestration module. Configuration and metadata types each have one schema owner.

### Boundaries That Limit Technical Debt

- Validate external data as `unknown` at its boundary. Do not let the SDK's permissive `any` declarations become application types. Preserve opaque node IDs and arbitrary custom-node inputs; do not generate a fixed catalogue of supported nodes.
- Determine output nodes from the server's node definitions (`output_node`) and workflow node classes. Do not guess from graph leaf nodes, display titles, or a hardcoded `SaveImage` class. Image availability is checked from the selected node's execution result.
- Keep coordinate enumeration and graph substitution pure and lazy. Retain the original graph and create an independent graph per combination, without materializing the entire Cartesian product.
- Keep the ComfyUI SDK inside one module. Export a narrow application-facing interface for node definitions, execution, and cleanup. Reuse public SDK APIs; exclude deprecated convenience methods and implicit timeout/retry behavior until their policy is specified in s0003.
- The generation function accepts its execution, image-processing, and storage collaborators explicitly. Use small function/object parameters for tests, without a dependency-injection container or a class hierarchy.
- The image module owns conversion, optimizer invocation, quality/size fallback, and subprocess cleanup. Invoke pngquant with an argument array and no shell. Distinguish expected quality/size rejection from actual failures using the tested binary's documented exit statuses.
- The catalog file module alone owns coordinate filenames and completion checks. Write files through temporary siblings and rename on success; publish the manifest only after its referenced files are saved. Invalidate an entry's completion record before replacing its files so an interrupted force run cannot appear complete.
- Keep errors contextual: operation, coordinate, prompt ID, and node ID when available. Report them at the CLI boundary and release connections/process resources in `finally` blocks.

### Execution Flow

1. Parse CLI arguments; load and validate configurations and the API workflow.
2. Check optimizer availability when enabled; obtain server node definitions and resolve the selected output node before generation or reset.
3. Prepare the output directory and metadata using the specified resume/reset policy.
4. For each pending coordinate, create its graph, execute it, retrieve the selected node's images, normalize/optimize them, and publish images and optional workflow sidecar.
5. Commit completion metadata after saving the entry; report progress and close resources on completion or failure.

## Choices to Resolve Before Their Implementation

These gaps already exist in the specs; do not silently encode library defaults as product policy:

- **Runtime:** choose the supported Node release and align types, compiler target, and CI.
- **s0002:** confirm configuration serialization and relative path resolution. Proposal: retain TOML and resolve workflow paths relative to the catalog configuration file. Also resolve overlapping variations that target the same input.
- **s0003:** define timeout, reconnection, and cancellation behavior, especially ambiguous submission outcomes. Proposal: no automatic resubmission after an uncertain result.
- **s0004:** finalize the metadata JSON schema and changed-input resume policy before implementing persistence. Proposal: version the schema and record a generation-input fingerprint to detect changed workflows/configurations.
- **s0004:** define concurrency and failure continuation. Proposal: process entries sequentially and stop on the first failed entry for the initial implementation.

## Implementation and Verification Order

1. Establish the template-derived toolchain and lock compatible dependencies; check a compiled CLI entry point on Windows and Linux.
2. Implement schema validation, graph targeting, output selection, and lazy enumeration with tests derived from s0002.
3. Test the ComfyUI adapter against a controlled local server: rejection, unrelated prompt events, execution failure, selected-node output, batches, and cleanup.
4. Test PNG conversion and optimizer outcomes with real fixtures and the selected pngquant binary. Compare sizes and visually inspect representative outputs before accepting the quality default.
5. Implement file publication and generation integration; test partial writes, resume, force interruption, flat names, and multiple images from the selected node.
6. Run lint, build, and compiled tests; perform an opt-in smoke test with an actual ComfyUI instance. Remove `UNIMPLEMENTED` markers only for behavior verified by the delivered implementation.
