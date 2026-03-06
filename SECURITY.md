# Security Policy

## Scope

This repository publishes a public web app, reference engine, tests, and public
data formats. Security reports should focus on issues that can affect users,
contributors, or downstream deployments.

This project is not an emergency dispatch or life-safety system. Do not rely on
it as the only source of critical safety information.

## Supported release line

- `main`
- latest GitHub Pages deployment

Older commits and forks may not receive fixes.

## How to report

Preferred path:

- use GitHub private vulnerability reporting if it is enabled for the
  repository

Fallback path:

- open a public issue with minimal details
- do not publish secrets, tokens, private coordinates, or weaponized repros
- clearly mark the title with `security:` so maintainers can triage it quickly

## What to include

- affected URL, file, or workflow
- impact summary
- step-by-step reproduction
- whether the issue affects public Pages, self-hosted installs, or both
- any temporary mitigation already tested

## Response target

- initial triage: within 7 days when possible
- fix or mitigation plan: as soon as a maintainer can reproduce the issue

## Out of scope

- already public third-party service limits or pricing changes
- missing hardening in forks not maintained here
- reports that require private keys or paid infrastructure the project does not
  control
