# Export Provenance

This repository should be treated as the published export of a separate local
source workspace.

## Current local source workspace observed on 2026-03-08

- Source workspace path: `D:\payolajoker_git\gilmaru`
- Source repository HEAD: `113c2e6ec94b2ebb5a1f065a4bc6157f2765ec82`
- Source working tree state at inspection: `dirty`
- Export script of record: `D:\payolajoker_git\gilmaru\scripts\prepare-public-release.cjs`
- Public export workspace path: `D:\payolajoker_git\gilmaru-public-release`

## Why this file exists

- The public repository is not the maintainer's only working tree.
- A bare public repo without source provenance makes future diffs, audits, and
  re-exports harder to trust.
- HEAD alone is not a complete reproduction key when the source workspace is
  dirty, so export-time provenance needs to be kept with the public repo.

## Export rules

- Treat the sibling `gilmaru` workspace as the source of truth for export
  preparation.
- Keep public-only metadata in the export templates or export script, not only
  in the published repo.
- If this repository is re-exported, update this file or regenerate it from the
  source export script before pushing.

## Source workspace status captured during inspection

```text
 M .gitignore
 M README.md
 M gilmaru_core.js
 M package.json
?? LICENSE
?? NOTICE
?? SESSION_CHECKPOINT.md
?? TRADEMARKS.md
?? docs/community-roadmap.md
?? docs/licenses/
?? docs/open-license-strategy.md
?? docs/open-tourism-deck-draft.md
?? docs/open-tourism-roadmap.md
?? docs/public-good-manifesto.md
?? docs/public-release-structure.md
?? docs/rights-inventory.md
?? gilmaru_engine.js
?? public-release-template/
?? public-release/
?? samples/
?? scripts/prepare-public-release.cjs
?? test/engine.test.js
```
