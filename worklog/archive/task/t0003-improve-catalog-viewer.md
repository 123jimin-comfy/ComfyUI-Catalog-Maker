+++
id = "t0003"
title = "Improve catalog browsing"
tags = ["viewer"]
status = "done"
modifies = ["s0005"]
blocked_by = []
+++

Implement the approved compact viewer feature sets in directly served browser modules. Keep view selection separate from DOM presentation so feedback can change either independently.

Verify filtering, axis selection, aligned comparisons, bounded rendering, partial catalogs, batch access, overlay navigation, and mobile layout; run repository checks. Update README and write back s0005 before archiving.

Delivered separate view planning and DOM presentation with directly served browser modules. Updated shared-resource assembly and README. Build and full suite passed (70 passed, three pngquant-dependent tests skipped). Nine focused viewer checks passed, including the browser test using 20 synthetic 512×512 images at mobile and desktop widths. Mobile screenshot inspected; lint passed. Browser checks cover filters, aligned comparisons, fixed axes, batch navigation, modal focus, missing and broken images, empty and invalid catalogs.
