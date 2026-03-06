# Contributing

Scope of contributions:

- application code
- engine logic
- tests
- docs
- word data and generation scripts
- community point packs and schema docs

Rules:

- Do not commit local keys or local config files.
- If you change word data, explain provenance and transformation steps in the
  pull request.
- If you change point-pack data, run `npm run validate:data` and explain the
  source, verification date, and review method.
- Keep pull requests reviewable and focused.
- Respect third-party terms for Kakao and other dependencies.
- If you add new assets, update the license or notice docs when needed.

Community standards:

- Read `CODE_OF_CONDUCT.md` before participating.
- Use the issue templates for bugs, ideas, and data-pack submissions.
- Large format changes should be discussed in an issue before a pull request.

Data contribution references:

- `docs/data-contribution-guide.md`
- `docs/point-pack-spec.md`
- `schemas/point-pack.schema.json`
