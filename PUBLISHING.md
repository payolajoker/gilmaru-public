# Publishing Guide

This export is meant to become a separate public repository.

This repository is not the maintainer's only working tree.

- Primary local source workspace currently used by the maintainer:
  `D:\payolajoker_git\gilmaru`
- Public release output workspace in this environment:
  `D:\payolajoker_git\gilmaru-public-release`
- Export provenance must be recorded in `EXPORT_PROVENANCE.md` before push.

## 1. Refresh the export from the main workspace

```bash
cd ..\gilmaru
npm run prepare:public-release
```

## 2. Verify provenance before pushing

- Check that `public-release/EXPORT_PROVENANCE.md` exists.
- Confirm that it captures the source HEAD and whether the source workspace was
  clean or dirty.
- If you changed public-only docs or workflow files, make sure the same change
  also exists in the source export script or `public-release-template/`.

## 3. Create a repository from `public-release/`

```bash
cd public-release
git init
git add .
git commit -m "Initial public repository export"
```

## 4. Validate before pushing

```bash
npm install
npm run validate:data
npm run test -- --run
npm run test:e2e
npm run build
```

## 5. Connect a remote

```bash
git remote add origin <YOUR_REMOTE_URL>
git branch -M main
git push -u origin main
```
