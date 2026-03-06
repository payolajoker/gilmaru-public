# Governance

## Project model

Gilmaru is run as a public-interest open source project. The goal is not to
maximize lock-in. The goal is to keep the core format, app, and data workflows
open enough that communities can fork, host, improve, and reuse them.

## Roles

- Maintainers: merge changes, cut releases, and make final calls when needed
- Reviewers: provide code, docs, accessibility, or data review
- Data stewards: review point-pack provenance and verification quality
- Contributors: submit issues, pull requests, docs, translations, and data

One person may hold multiple roles.

## Decision process

- Small changes: normal pull-request review
- Medium changes: issue discussion first, then pull request
- Major changes: open an issue or short RFC before implementation

Major changes include:

- schema changes in `schemas/`
- license or trademark policy changes
- new external providers
- breaking data-format changes

Maintainers should prefer rough consensus. If consensus does not form, a
maintainer may decide and record the reason in the issue or pull request.

## Release rules

- `main` is the active release line
- CI must pass before merge
- data-format changes should include docs and validator updates together
- public Pages deployments should stay reproducible from the repository alone

## Review priorities

1. user harm or safety risk
2. accessibility regressions
3. data correctness and provenance
4. build and deployment stability
5. new features

## Non-goals

- private feature gates on core formats
- contributor lock-in
- opaque data review rules
