+++
id = "t0002"
title = "Implement in-place static catalog website"
tags = ["cli", "viewer"]
status = "done"
modifies = ["s0001", "s0005"]
blocked_by = []
+++

## Plan

- Implement the approved proposal in worklog/static-webpage-plan.md: explicit generate/web CLI, shared packaged resources, arbitrary served roots, and no catalog copies.
- Add behavioral command tests before implementation; retain generation coverage under the new CLI.
- Share metadata validation, protect viewer paths, and implement idempotent assembly.
- Replace the legacy static viewer with a minimal current-format gallery.
- Verify lint/build/tests, installed resources, external site roots, and browser behavior. Write back specifications and archive.

## Decisions

- User explicitly permits breaking CLI/data compatibility and requests direct generation under arbitrary public directories.
- Keep the current generated metadata contract; category remains a candidate display attribute.
- Generate and web commands remain independent; web replaces the complete ordered list without deleting catalogs.

## Progress

- Approved behavior recorded with unimplemented markers before implementation.
- Added CLI and isolated command-level tests before site implementation. Observed missing subcommands/site failures; the implemented command passes those regressions.
- Implemented explicit generate/web routing, lazy generation imports, shared metadata validation, viewer-root generation protection, and in-place site assembly with preflight validation and atomic file replacement.
- Replaced the old static viewer with a current-format gallery; added browser-data tests and lint coverage for browser JavaScript.
- Verified offline installation of the packed package in an external temporary directory and assembly from an unrelated working directory. Only four canonical static resources ship; generated outputs do not.
- Browser verification passed in installed-package Chromium: root/nested URLs, 1280px desktop and 375px mobile, numeric coordinate ordering, every batch image, selected-only metadata loading, safe text, empty/partial catalogs, stale requests, metadata updates without reindexing, broken images, invalid versions, and empty lists. No page errors or third-party requests. Screenshots inspected under local/web-check/.
- Final validation: lint and TypeScript build passed; 58 tests passed, 2 existing optimizer tests skipped because pngquant was unavailable; git diff --check passed. Source-root overlap and reserved-resource rejection are covered. Documented pnpm start web --help verified.
