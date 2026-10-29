---
name: pnpm security policy
description: Preserve the workspace's minimum package release age when updating dependencies.
---

After running `pnpm add` or `pnpm install`, inspect `pnpm-workspace.yaml`. The package manager can normalize that file and remove or rewrite the workspace's minimum release age and trusted-package allowlist. Keep unrelated dependency changes, but restore the intentional security policy.

**Why:** this workspace intentionally delays new package releases by 24 hours to reduce supply-chain risk.

**How to apply:** review the workspace-file diff after package commands, and do not bypass the release-age protection to install a just-published version.
