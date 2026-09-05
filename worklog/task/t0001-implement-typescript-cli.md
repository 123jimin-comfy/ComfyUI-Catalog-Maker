+++
id = "t0001"
title = "Implement TypeScript catalog CLI"
tags = ["cli", "configuration", "workflow", "generation"]
status = "active"
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

- Template and installed SDK inspected; dependency setup started.
