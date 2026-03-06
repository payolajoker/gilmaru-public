# Vendored Runtime Notes

This directory contains third-party runtime files copied into the repository
to reduce CDN dependence for core public-app flows.

Included files:

- `qrcode.min.js`
  - upstream: `davidshimjs/qrcodejs`
  - source: https://github.com/davidshimjs/qrcodejs
  - license: MIT
  - role: client-side QR rendering for the share card modal

- `html2canvas.min.js`
  - upstream: `niklasvh/html2canvas`
  - source: https://github.com/niklasvh/html2canvas
  - license: MIT
  - role: client-side PNG export for the QR card

Notes:

- These files keep their upstream licenses and are not re-licensed under the
  repository default code license.
- They are loaded lazily at runtime to avoid inflating the initial bundle.
