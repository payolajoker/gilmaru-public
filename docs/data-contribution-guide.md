# Point Pack Contribution Guide

Gilmaru now treats community point packs as a first-class public asset. The
goal is simple: a local team should be able to publish a useful pack without
building a new app from scratch.

## What belongs in a point pack

Good candidates:

- accessible entrances
- accessible parking
- ramps
- elevators
- accessible restrooms
- rest areas
- meeting points
- info desks
- transit stops
- quiet rooms

Avoid:

- private personal locations
- live personal tracking data
- unverifiable rumors
- emergency-only claims that the project cannot guarantee

## Submission checklist

1. Put the pack JSON under `data/point-packs/`.
2. Validate it with `npm run validate:data -- <path>`.
3. Explain provenance and verification in the pull request.
4. Add or update docs if the schema changed.

## Minimum review standard

A pack should tell reviewers:

- who produced it
- where the coordinates came from
- when the locations were last checked
- what each point is for
- whether a point is verified, reported, temporary, or inactive

## Suggested directory layout

```text
data/
  point-packs/
    examples/
      seoul-cityhall-access-pack.json
```

## Validation command

```bash
npm run validate:data
npm run validate:data -- data/point-packs/examples/seoul-cityhall-access-pack.json
```

## Related files

- `docs/point-pack-spec.md`
- `schemas/point-pack.schema.json`
- `scripts/validate-point-pack.mjs`
