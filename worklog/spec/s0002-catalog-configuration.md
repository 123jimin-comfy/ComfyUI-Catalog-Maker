+++
id = "s0002"
title = "Catalog Configuration"
tags = ["configuration"]
+++

## Observable Behavior

- UNIMPLEMENTED: A separate backend configuration supplies the ComfyUI server URL and optional HTTP Basic authentication used to execute the catalog's workflow.
- UNIMPLEMENTED: Each catalog configuration identifies the catalog, references one user-supplied ComfyUI API workflow file, and defines one or more variations. The workflow is the complete executable node graph, including model loading, sampling, and output nodes as defined by its author.
- UNIMPLEMENTED: A variation names a dimension of comparison, identifies a node input to change, and supplies its candidate values.
- UNIMPLEMENTED: For each combination in the Cartesian product of variation values, apply the selected values to a fresh copy of the workflow at `workflow[target.node].inputs[target.input]`. All other inputs and node connections retain their supplied values; the source file is unchanged.
- UNIMPLEMENTED: Candidate values can carry a display label and an optional category, separate from the value applied to the workflow. Categorized and uncategorized values can coexist; category information remains available to the catalog viewer.

### Configuration Schema

UNIMPLEMENTED: Backend and catalog configurations are separate files with the following complete logical schemas. TypeScript is pseudocode, not a required file format.

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
  variations: NonEmpty<Variation>;
}

interface Variation {
  name: string;                       // Display name of the comparison dimension.
  target: {
    node: string;                     // Exact API graph key, e.g. "60:19"; not a node title.
    input: string;                    // Input name on that node, e.g. "cfg".
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

- UNIMPLEMENTED: The workflow file must use ComfyUI's API format: an object keyed by node IDs, with `class_type` and `inputs` per node. An editor workflow containing `nodes`, layout, and widget state must be exported to API format in ComfyUI before use.
- UNIMPLEMENTED: Generation structure and baseline input values come from the supplied workflow, without a required built-in pipeline or hardcoded generation defaults.
- UNIMPLEMENTED: Backend configuration contains connection settings only; it does not define generation parameters or workflow overrides.
- UNIMPLEMENTED: Each variation must contain at least one candidate value and resolve to an existing input in the workflow. Invalid references must be reported before generation.
- UNIMPLEMENTED: Categories organize values; they do not change the values applied to workflow inputs or add generation combinations.
- UNIMPLEMENTED: Candidate values must be compatible with their targeted workflow input; JSON representability alone does not establish compatibility.

## Anticipated Changes

- Configuration serialization and relative workflow path resolution remain to be specified.

## Dangers

- Combining many candidate values can produce a large number of generation jobs.
- Editing a supplied workflow can invalidate variation targets or change baseline values.
- Workflow nodes and model assets may be unavailable on the connected ComfyUI server.
