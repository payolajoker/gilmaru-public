# Session Checkpoint

Updated: 2026-03-07

## Repo status

- Path: `D:\payolajoker_git\gilmaru-public-release`
- Remote: `https://github.com/payolajoker/gilmaru-public`
- Branch: `main`
- HEAD: `54d414bf47cbe8fe7ef2023edd1aad823e34e092`
- Working tree: clean
- Live URL: `https://payolajoker.github.io/gilmaru-public/`
- Live app version: `Gilmaru v1.7.13`

## Completed milestones

- Public GitHub repo created and pushed
- GitHub Pages deployed
- OpenStreetMap provider path added
- Open geocoder local/proxy/fallback modes added
- Open geocoder proxy server script added
- Mobile bottom-sheet and action-row QA fixes done
- Accessibility base improvements added
- Offline banner and cached snapshot recovery added
- SVG icon system added
- QRCode and html2canvas already local-vendored
- Leaflet moved to local vendored runtime
- External Pretendard font CDN removed in favor of Korean-friendly system font stack

## Latest commits

- `54d414b` `Vendor Leaflet and drop font CDN`
- `a6c75b6` `Add open geocoder proxy support`

## Current external dependencies still relevant

- Kakao Maps JavaScript SDK / Places
- OpenStreetMap tile service
- Nominatim or a self-hosted/proxied geocoder

## Last verification

Passed on latest commit:

- `npm run build`
- `npm run test -- --run`
- `npm run test:e2e`

Result:

- `40 passed` E2E

## Suggested next work

1. Kakao dependency reduction
2. Accessibility depth pass
3. Open mode default-policy decision
4. Optional self-hosting docs for tile/geocoder stack

## Resume prompt

`SESSION_CHECKPOINT.md 읽고 여기서부터 이어서 진행해`
