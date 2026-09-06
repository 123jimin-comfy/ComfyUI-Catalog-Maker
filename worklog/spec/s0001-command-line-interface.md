+++
id = "s0001"
title = "Command-Line Interface"
tags = ["cli"]
paths = ["src/bin/**","src/cli/**"]
+++

## Observable Behavior

- `comfy-catalog generate -b <backend-config> <catalog-config> <output-dir>` generates one catalog using the configurations defined in s0002 and the generation behavior in s0004. The catalog configuration references its workflow file.
- `comfy-catalog web --root <site-root> <metadata-file>...` assembles the static viewer defined in s0005, with one or more metadata paths in display order. Both commands accept absolute paths or paths relative to the working directory. Site roots can be outside the project or installed package.
- Root help lists explicit generation and web subcommands; each subcommand has its own help. The former executable and implicit generation arguments are not supported.
- The generation command accepts these options:

  | Option | Behavior |
  | --- | --- |
  | `-b`, `--backend PATH` | Required backend configuration file. |
  | `-f`, `--force` | Regenerate existing catalog images. |
  | `--reset` | Remove the selected output directory's contents before generation; implies force. |
  | `--gen-info` | Save the resolved workflow used for each generated combination alongside its images. |
  | `--png-quality MIN-MAX` | Set the pngquant quality range for the optimization defined in s0004. |
  | `--no-png-optimization` | Save PNG images without lossy optimization. |
  | `-h`, `--help` | Show usage and options without generating a catalog. |

- `<output-dir>` is the catalog root. Write metadata, images, and optional workflow sidecars directly into it using the flat layout in s0004; do not append the catalog ID. Create the output directory if missing.
- PNG optimization is enabled by default under the policy in s0004. Quality settings affect newly saved images; skipped entries are unchanged. Use `--force` to regenerate existing entries with different settings.
- Report generation and skip progress. Exit with zero on success and a nonzero status with an error description when arguments, configuration, execution, or output writing fail.

## Constraints

- Missing required arguments and unreadable or invalid configuration or workflow files fail before submitting generation jobs or resetting output.
- Quality bounds must be integers satisfying `0 <= MIN <= MAX <= 100`. Reject combining `--png-quality` with `--no-png-optimization`. When optimization is enabled, verify that pngquant is available before submitting jobs or resetting output; report a missing optimizer as an error.
- The CLI delegates workflow interpretation to s0002 and execution to s0003; it does not supply model, sampler, prompt, or seed defaults.
- Reject generation directly into an identifiable viewer root before destructive output preparation. Generate each catalog into its own directory beneath the served root; resetting that catalog does not reset the site.
- Web assembly and help do not require backend configuration, ComfyUI connectivity, or an image optimizer.

## Anticipated Changes

- Dry-run validation and concurrency controls remain proposals.

## Dangers

- Selecting the wrong output directory with `--reset` can delete unrelated files.
- Ending the command does not necessarily cancel an already submitted ComfyUI job.
