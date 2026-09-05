+++
id = "s0001"
title = "Command-Line Interface"
tags = ["cli"]
+++

## Observable Behavior

- UNIMPLEMENTED: `make-comfy-catalog -b <backend-config> <catalog-config> <output-dir>` generates one catalog using the configurations defined in s0002 and the generation behavior in s0004. The catalog configuration references its workflow file.
- UNIMPLEMENTED: The command accepts these options:

  | Option | Behavior |
  | --- | --- |
  | `-b`, `--backend PATH` | Required backend configuration file. |
  | `-f`, `--force` | Regenerate existing catalog images. |
  | `--reset` | Remove the selected output directory's contents before generation; implies force. |
  | `--gen-info` | Save the resolved workflow used for each generated combination alongside its images. |
  | `-h`, `--help` | Show usage and options without generating a catalog. |

- UNIMPLEMENTED: Report generation and skip progress. Exit with zero on success and a nonzero status with an error description when arguments, configuration, execution, or output writing fail.

## Constraints

- UNIMPLEMENTED: Missing required arguments and unreadable or invalid configuration or workflow files fail before submitting generation jobs or resetting output.
- UNIMPLEMENTED: The CLI delegates workflow interpretation to s0002 and execution to s0003; it does not supply model, sampler, prompt, or seed defaults.

## Anticipated Changes

- Configuration serialization and relative workflow path resolution remain open in s0002.
- Dry-run validation, concurrency controls, and viewer bundle export remain proposals.

## Dangers

- Selecting the wrong output directory with `--reset` can delete unrelated files.
- Ending the command does not necessarily cancel an already submitted ComfyUI job.
