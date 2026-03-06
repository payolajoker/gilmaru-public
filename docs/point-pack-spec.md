# Gilmaru Point Pack Spec

This document defines the first public JSON format for sharing Gilmaru point
packs. The format is intentionally small. It is meant to be easy to review,
fork, and validate by community maintainers.

## Status

- schema version: `1.0.0`
- canonical schema file: `schemas/point-pack.schema.json`
- validator command: `npm run validate:data`

## Root object

Required fields:

- `schemaVersion`
- `packId`
- `name`
- `language`
- `license`
- `maintainers`
- `points`

Optional fields:

- `summary`
- `homepage`
- `region`
- `sources`

## Pack metadata

- `packId`: stable lowercase ID such as `seoul-cityhall-access-pack`
- `language`: BCP 47 style tag such as `ko-KR`
- `license`: license for the pack data itself
- `maintainers`: people or groups responsible for updates
- `region`: optional coarse region metadata for discovery

## Point types

Current supported `type` values:

- `entrance`
- `accessible_parking`
- `ramp`
- `elevator`
- `accessible_restroom`
- `rest_area`
- `meeting_point`
- `info_desk`
- `transit_stop`
- `quiet_room`

## Point status

Each point must use one of these states:

- `verified`: checked and believed current
- `reported`: community-reported, not yet confirmed
- `temporary`: short-lived setup such as an event point
- `inactive`: known but not currently usable

`verified` points should include `verifiedAt`.

## Point object

Required point fields:

- `id`
- `type`
- `name`
- `coordinates`
- `status`
- `lastUpdated`

Optional point fields:

- `description`
- `gilmaruCode`
- `verifiedAt`
- `tags`
- `links`
- `accessibility`

## Coordinates

`coordinates` uses decimal degrees:

```json
{
  "lat": 37.5662952,
  "lng": 126.9779451
}
```

## Accessibility object

The optional `accessibility` object is intentionally small in version 1:

- `stepFree`: boolean
- `doorWidthCm`: number
- `notes`: short human-readable note

Future versions can add richer fields once enough real packs exist.

## Example

See:

- `data/point-packs/examples/seoul-cityhall-access-pack.json`

## Compatibility notes

- The current web app does not yet render point packs directly.
- The schema exists now so communities can start publishing reviewable data.
- Future import/export and GeoJSON bridges should preserve these fields where
  possible.
