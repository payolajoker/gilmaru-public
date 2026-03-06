# Excluded Assets

The public release export intentionally excludes local-only or non-source assets.

Excluded examples:

- `gilmaru.config.local.json`
- `node_modules/`
- `dist/`
- `public-release/`
- `public-release-template/`
- `test-results/`
- `.playwright-cli/`
- local screenshots, manual build outputs, and workspace-only artifacts

The goal is to export the actual open repository contents, not machine-local
state.
