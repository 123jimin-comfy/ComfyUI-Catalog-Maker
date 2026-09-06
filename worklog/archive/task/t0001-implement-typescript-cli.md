+++
id = "t0001"
title = "Implement TypeScript catalog CLI"
tags = ["cli", "configuration", "workflow", "generation"]
status = "done"
modifies = ["s0001", "s0002", "s0003", "s0004"]
blocked_by = []
+++

Implement s0001–s0004 using the TypeScript Node template and ArkType. Viewer excluded.

## Plan

- Adopt template build/lint/tests; install approved dependencies.
- Record accepted TOML, relative workflow paths, sequential generation, no resubmission, and fingerprinted metadata policies.
- Write behavioral CLI tests against a controlled ComfyUI server before implementing the CLI.
- Implement typed boundaries, graph operations, SDK transport adapter, image pipeline, persistence, and CLI.
- Verify lint/build/tests, pngquant behavior, and resume/failure handling; write back specs and archive.

## Decisions

- Runtime/build follows the reference template without an added runtime matrix or packaging artifacts.
- ArkType replaces Zod; image indexing remains unchanged.
- Use job-specific history through the existing SDK transport; its queue-absence convenience check is insufficient evidence of completion.

## Progress

- Implemented TypeScript CLI, ArkType boundaries, TOML loading, placeholder and whole-input variations, SDK adapter, PNG pipeline, metadata, and flat output persistence.
- Added behavioral CLI tests before implementation and a failing regression test before fixing stale files from interrupted batches.
- Live test authorized by the user for the configured backend. One image generated at 512x512 and 20 steps using the exact user-provided prompt; rerun skipped it.
- Official Windows pngquant 2.17.0 tested. Default quality 85–95 retained the live original (356,369 bytes); offline 75–90 produced 125,490 bytes, 64.8% smaller, with visible dithering. Default unchanged.
- Final verification: template lint, TypeScript compilation, and all 21 tests passed with pngquant enabled. Current local live catalog has four completed character entries, each 512x512 at 20 steps. Viewer untouched.
