+++
id = "s0004"
title = "Catalog Generation"
tags = ["generation"]
paths = ["src/catalog/**","src/image/**"]
+++

## Observable Behavior

- Load the catalog's workflow and enumerate the variation combinations defined in s0002. Each combination identifies one catalog entry and supplies one resolved graph for execution under s0003.
- Save the selected output node's images under the output directory and associate each image with its variation coordinate. Preserve all images in a batch from that node.
- Write a catalog metadata manifest containing catalog identity, variation names and targets, candidate values with their labels and categories, and the mapping from variation coordinates to saved images.
- Skip completed entries by default so rerunning an unchanged catalog resumes unfinished work. `--force` regenerates existing entries; `--reset` clears output as defined in s0001.
- With `--gen-info`, save each generated entry's resolved workflow so its actual input values and node connections can be inspected.
- Treat execution without image outputs, failed image retrieval, and failed output writes as generation failures. Report the affected combination; an incomplete entry is not complete merely because one image exists.

### Output Directory

One output directory contains one catalog. All catalog files reside directly in it, with no entry or node subdirectories:

```text
<output-dir>/
  metadata.json
  <coordinate>.<image-index>.png
  <coordinate>.workflow.json         # Only with --gen-info.
```

- A coordinate joins zero-based candidate indices in configuration variation order with hyphens: `0-2` selects the first value of the first variation and the third value of the second. A single variation uses one index.
- Image indices are zero-based and follow the selected node's returned order; always include the index, even for a single image. For coordinate `0-2`, the first image is `0-2.0.png`. Record the selected output node ID once in catalog metadata and each image's index and filename. Use decimal indices without padding.
- `metadata.json` contains the catalog manifest; `<coordinate>.workflow.json` contains the entry's resolved API graph shared by its images. Labels, categories, model names, and remote filenames do not form local filenames.
- Record an entry as complete in metadata only after every image and requested workflow sidecar is saved. Resume skips an entry only when that record and all referenced files exist.

### Lossy PNG Optimization

- Optimize each downloaded PNG before saving it, using the existing [pngquant](https://pngquant.org/) executable rather than a custom quantizer. Default to `--quality=85-95 --skip-if-larger`, leaving adaptive dithering enabled. `--png-quality` overrides the quality range; `--no-png-optimization` bypasses this step.
- Keep the optimized PNG only when it meets pngquant's minimum quality and is strictly smaller than the downloaded PNG. Otherwise save the original PNG. Quality rejection and size-based skipping are normal fallbacks; other optimizer errors are generation failures.
- Preserve image dimensions and transparency support; do not resize, crop, or flatten images. Optimize only from downloaded originals, never from previously quantized catalog images. Publish only the selected PNG, without keeping a duplicate original in the catalog.
- If an image arrives in another format, convert its decoded pixels to PNG without additional lossy encoding before applying this policy. Use that PNG as the fallback and size-comparison baseline.

### Metadata Schema

`metadata.json` has this schema; entry presence means all referenced files were saved successfully. `Variation` is defined in s0002.

```typescript
interface CatalogMetadata {
  version: 1;
  fingerprint: string; // SHA-256 of canonical catalog settings, source graph, and selected output node.
  id: string;
  name: string;
  output_node: string;
  variations: Variation[];
  entries: Record<string, {
    coordinate: number[];
    prompt_id: string;
    images: { index: number; file: string }[]; // Nonempty; flat filenames in returned order.
    workflow?: string; // Flat workflow sidecar filename.
  }>;
}
```

- Fingerprinting excludes backend credentials, the workflow file's location, and CLI optimization options. Object keys are sorted; array order is preserved. Unknown metadata versions and invalid coordinates or filenames are rejected before reuse.

## Constraints

- Execute entries sequentially and stop at the first failure.
- Metadata has a schema version and a fingerprint of the catalog configuration and source workflow. Reject reuse when the fingerprint changes unless `--force` or `--reset` is supplied. Optimization options do not invalidate already completed entries.
- Apply the fresh-copy and baseline-preservation rules in s0002 independently for each entry. Do not randomize seeds or derive defaults from model names.
- Entries and their images must remain distinguishable even when labels or categories repeat. Categories are preserved as metadata and do not affect enumeration.
- Metadata must refer to saved images and preserve enough coordinate information to recover the selected candidate for every variation.

## Anticipated Changes

## Dangers

- Large variation products and batches can consume substantial execution time and disk space.
- Reusing output after changing a workflow or configuration can mix images generated with different settings.
- An interruption can leave partially saved entries that must not be skipped as complete.
- Palette quantization can introduce banding or dithering that obscures subtle generation differences. The quality score is an optimizer estimate, not a percentage of perceived fidelity; the default range needs visual evaluation on representative catalog images.
