+++
id = "s0004"
title = "Catalog Generation"
tags = ["generation"]
+++

## Observable Behavior

- UNIMPLEMENTED: Load the catalog's workflow and enumerate the variation combinations defined in s0002. Each combination identifies one catalog entry and supplies one resolved graph for execution under s0003.
- UNIMPLEMENTED: Save the returned images under the selected output directory and associate each image with its variation coordinate and output node. Preserve multiple images returned for an entry; do not assume one workflow execution produces exactly one image.
- UNIMPLEMENTED: Write a catalog metadata manifest containing catalog identity, variation names and targets, candidate values with their labels and categories, and the mapping from variation coordinates to saved images.
- UNIMPLEMENTED: Skip completed entries by default so rerunning an unchanged catalog resumes unfinished work. `--force` regenerates existing entries; `--reset` clears output as defined in s0001.
- UNIMPLEMENTED: With `--gen-info`, save each generated entry's resolved workflow so its actual input values and node connections can be inspected.
- UNIMPLEMENTED: Treat execution without image outputs, failed image retrieval, and failed output writes as generation failures. Report the affected combination; an incomplete entry is not complete merely because one image exists.

## Constraints

- UNIMPLEMENTED: Apply the fresh-copy and baseline-preservation rules in s0002 independently for each entry. Do not randomize seeds or derive defaults from model names.
- UNIMPLEMENTED: Entries and their images must remain distinguishable even when labels or categories repeat. Categories are preserved as metadata and do not affect enumeration.
- UNIMPLEMENTED: Metadata must refer to saved images and preserve enough coordinate information to recover the selected candidate for every variation.

## Anticipated Changes

- Exact output layout, metadata serialization schema, and completion tracking remain to be specified.
- Detecting configuration or workflow changes when resuming, and deciding whether to reuse previous images, remain to be specified.
- Concurrency and whether to continue after an entry fails remain to be specified.

## Dangers

- Large variation products, batches, and multiple output nodes can consume substantial execution time and disk space.
- Reusing output after changing a workflow or configuration can mix images generated with different settings.
- An interruption can leave partially saved entries that must not be skipped as complete.
