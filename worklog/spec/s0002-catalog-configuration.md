+++
id = "s0002"
title = "Catalog Configuration"
tags = ["configuration"]
paths = ["src/config/**","src/workflow/**"]
+++

## Observable Behavior

- A separate backend configuration supplies the ComfyUI server URL and optional HTTP Basic authentication used to execute the catalog's workflow.
- Each catalog configuration identifies the catalog, references one user-supplied ComfyUI API workflow file, and defines one or more variations. The workflow is the complete executable node graph, including model loading, sampling, and output nodes as defined by its author.
- A variation names a dimension of comparison, identifies a node input to change, and supplies its candidate values.
- Text variations may target distinct literal placeholders within the same string input, allowing character and gesture to vary independently. Replace all occurrences using the original input text; inserted values are not interpreted as further placeholders.
- Use the workflow's sole output node by default. When the workflow has multiple output nodes, require `output_node` to select the node whose images populate the catalog.
- For each combination in the Cartesian product of variation values, apply whole-input replacements or text substitutions to a fresh copy at `workflow[target.node].inputs[target.input]`. All other inputs and node connections retain their supplied values; the source file is unchanged.
- Candidate values can carry a display label and an optional category, separate from the value applied to the workflow. Categorized and uncategorized values can coexist; category information remains available to the catalog viewer.

### Configuration Schema

Backend and catalog configurations are separate files with the following complete logical schemas. TypeScript is pseudocode, not a required file format.

```typescript
interface BackendConfig {
  comfy: {
    url: string;                      // ComfyUI server URL.
    auth?: {                          // Omit when HTTP Basic authentication is unused.
      username: string;
      password: string;
    };
  };
}

type NonEmpty<T> = [T, ...T[]];
type JsonValue =
  | null | boolean | number | string
  | JsonValue[]
  | { [key: string]: JsonValue };

interface CatalogConfig {
  id: string;                         // Catalog identity.
  name: string;                       // Human-readable catalog name.
  workflow: string;                   // Path to one ComfyUI API-format JSON export.
  output_node?: string;               // Exact output node ID; required when multiple exist.
  variations: NonEmpty<Variation>;
}

interface Variation {
  name: string;                       // Display name of the comparison dimension.
  target: {
    node: string;                     // Exact API graph key, e.g. "60:19"; not a node title.
    input: string;                    // Input name on that node, e.g. "cfg".
    placeholder?: string;             // Literal text to replace; omitted replaces the whole input.
  };
  values: NonEmpty<CandidateValue>;
}

interface CandidateValue {
  value: JsonValue;                   // Actual replacement input value.
  label?: string;                     // Optional display text.
  category?: string;                  // Optional category name; omitted = uncategorized.
}
```

## Constraints

- Backend and catalog files use TOML. Resolve relative workflow paths against the catalog configuration file's directory.
- Variations sharing a node input must use distinct, non-overlapping placeholders. Each placeholder must exist in the original string input, and its candidate values must be strings. Whole-input replacements cannot share a target with another variation.
- The workflow file must use ComfyUI's API format: an object keyed by node IDs, with `class_type` and `inputs` per node. An editor workflow containing `nodes`, layout, and widget state must be exported to API format in ComfyUI before use.
- Generation structure and baseline input values come from the supplied workflow, without a required built-in pipeline or hardcoded generation defaults.
- Backend configuration contains connection settings only; it does not define generation parameters or workflow overrides.
- Each variation must contain at least one candidate value and resolve to an existing input in the workflow. Invalid references must be reported before generation.
- Categories organize values; they do not change the values applied to workflow inputs or add generation combinations.
- Candidate values must be compatible with their targeted workflow input; JSON representability alone does not establish compatibility.
- Reject workflows with no output node, an invalid `output_node`, or multiple output nodes without a selector before generation. The selected node must produce images; selection does not modify the workflow graph.

## Anticipated Changes

## Dangers

- Combining many candidate values can produce a large number of generation jobs.
- Editing a supplied workflow can invalidate variation targets or change baseline values.
- Workflow nodes and model assets may be unavailable on the connected ComfyUI server.
