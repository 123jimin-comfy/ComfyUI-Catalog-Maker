+++
id = "s0005"
title = "Catalog Viewer"
tags = ["viewer"]
paths = ["src/web/**", "static/**"]
+++

## Observable Behavior

- Assemble a static website from shared browser resources, an ordered catalog list, and generated catalog outputs already inside a caller-selected served root. The root may be outside the repository and installed package.
- Install shared resources without a frontend build step, skipping byte-identical resources. Generate a versioned list containing each catalog's display name and relative metadata URL. Preserve the supplied catalog order; reject duplicate resolved metadata paths. Distinct catalogs may share IDs or names.
- Reference catalog output in place without copying, moving, linking, or rewriting it. Replacing the list does not delete omitted catalogs. Resuming generation in a listed catalog becomes visible on viewer reload without another assembly command, subject to hosting cache policy.
- Show a compact, mobile-friendly catalog selector and image browser with reduced spacing and usable touch controls. Show catalog names without order numbers; omit redundant headings and completion counts. Fetch only the selected catalog's metadata.
- Identify image parameters through shared axis headers, fixed selections, and minimal captions. Use candidate labels with textual-value fallback; expose full values and categories on demand and distinguish repeated labels and batch images.
- Support a gallery plus matrix, single-row, and single-column views for two-dimensional browsing. Allow axis swapping and movement between rows or columns. Compare selected rows or columns with images aligned by the other parameter.
- Filter candidate values or categories. For more than two dimensions, select two visible axes and fix the remaining dimensions to selected values.
- Open images uncropped in a same-page overlay with a visible close button; closing restores browsing position. Make every batch image accessible in recorded order.
- Provide desktop hotkeys for image and row/column navigation, opening the focused image, and closing with Escape, with a compact shortcut reference.
- Keep large catalogs responsive by bounding rendered image cells and loading images as needed. Preserve numeric candidate order and distinguish missing combinations without inventing image URLs.
- Support partial catalogs and readable loading, empty-list, empty-catalog, invalid-data, and broken-image states. Missing coordinates are ungenerated; never infer their image URLs. Ignore stale catalog loads after selection changes. Lazy-load gallery images.

## Constraints

- Validate supported metadata schema, coordinates, filenames, referenced nonempty regular files, and containment before changing viewer output. All catalog files and resolved symlink targets must remain under the selected served root, not necessarily under the project. Reject catalogs overlapping reserved viewer resources and roots overlapping canonical source resources.
- Update known shared resources only and atomically replace the catalog list after validation and successful resource writes. Reject incompatible filesystem entries; never recursively reset the site.
- Package browser resources with the CLI, excluding generated site output. Resolve source resources independently of the caller's working directory. Browser assets require no third-party services or generation dependencies.
- Use relative, encoded URLs so sites work at a hosting root or beneath a subdirectory and can be relocated as a unit. Serve using static HTTP(S); double-click local-file browsing is not supported.
- Use current generated metadata directly without legacy-format adapters or a transformed per-catalog dataset. Render user-supplied text as text, not executable markup.
- Keep browsing and presentation logic easy to revise as feedback changes the specification. Previous experiments do not define product scope.

## Anticipated Changes

- Persistent selections remain a proposal.

## Dangers

- Selected-catalog metadata is loaded in memory even when rendered image cells are bounded.
- Files beneath a served root, including generated workflow sidecars, are exposed by the static host.
- Shared-resource updates and catalog-list replacement are not a whole-site atomic transaction.
