# Gilmaru Public Release Staging Bundle

This directory contains a safe subset of the Gilmaru repository that can be reviewed, shared, or moved into a separate repository without the blocked word-data assets.

Included:
- Pure engine code with no bundled runtime word database
- Tiny sample word pack curated from the current runtime groups
- Standalone browser demo with no Kakao dependency
- Engine-focused tests
- Public-interest and licensing strategy documents

Excluded:
- `word_data.js`
- `topik_vocabulary_combined.csv`
- `mecab_*.csv`
- Derived word lists and runtime word outputs
- Kakao-dependent application shell

This bundle is a staging structure, not the final public repository. Final licensing still depends on the rights review in `docs/rights-inventory.md`.

## Quick Start

```bash
npm install
npm run dev
npm run test
npm run build
```

## What This Bundle Demonstrates

- The Gilmaru engine can run without the blocked runtime word database
- A curated sample word pack can be injected into the resolver
- A separate public repository can begin as engine-plus-demo before the final data strategy is settled
