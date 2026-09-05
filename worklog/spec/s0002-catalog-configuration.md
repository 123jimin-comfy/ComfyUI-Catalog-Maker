+++
id = "s0002"
title = "Catalog Configuration"
tags = ["configuration"]
+++

## Observable Behavior

- UNIMPLEMENTED: Each catalog configuration identifies the catalog, references one or more user-supplied ComfyUI workflow files, and defines one or more variations.
- UNIMPLEMENTED: A variation names a dimension of comparison, identifies the workflow input to change, and supplies its candidate values. Targets distinguish the workflow, node, and input rather than relying on a fixed list of generation parameters.
- UNIMPLEMENTED: Each combination of variation values is applied to the referenced workflows. Inputs not varied retain their values from the supplied workflow.
- UNIMPLEMENTED: Candidate values can carry a display label and an optional category, separate from the value applied to the workflow. Categorized and uncategorized values can coexist; category information remains available to the catalog viewer.

## Constraints

- UNIMPLEMENTED: Generation structure and baseline input values come from the supplied workflows, without a required built-in pipeline or hardcoded generation defaults.
- UNIMPLEMENTED: Each variation must contain at least one candidate value and resolve to an existing input in a referenced workflow. Invalid references must be reported before generation.
- UNIMPLEMENTED: Categories organize values; they do not change the values applied to workflow inputs or add generation combinations.

## Anticipated Changes

- Configuration syntax, supported workflow export formats, and how variations are combined across multiple workflows remain to be specified.

## Dangers

- Combining many candidate values can produce a large number of generation jobs.
- Editing a supplied workflow can invalidate variation targets or change baseline values.
- Workflow nodes and model assets may be unavailable on the connected ComfyUI server.
