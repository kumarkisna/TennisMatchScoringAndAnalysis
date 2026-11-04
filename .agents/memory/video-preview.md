---
name: Video preview diagnostics
description: Distinguish a missing development banner from actual video-rendering failures.
---

When the Replit Vite preview displays the video but the browser reports the development-banner script missing at the origin root, treat it as ancillary only after the production build and recording-lifecycle checks pass. Do not modify the protected video scaffold solely to silence the banner request.

**Why:** The proxy can let the animation render while a development-only banner requests the wrong base path; treating that as a content failure wastes time and risks unrelated scaffold changes.

**How to apply:** Confirm a rendered scene and passing production build and lifecycle validation. Investigate further only if the animation itself fails to render or those checks fail.
