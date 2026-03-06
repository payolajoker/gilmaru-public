# Publishing Guide

This bundle is meant to be copied into a separate repository when you are ready.

## 1. Refresh the bundle from the main repository

From the main Gilmaru repository:

```bash
npm run prepare:public-release
```

## 2. Create a new repository from this directory

```bash
cd public-release
git init
git add .
git commit -m "Initial public-release staging bundle"
```

Then connect a remote and push:

```bash
git remote add origin <YOUR_REMOTE_URL>
git branch -M main
git push -u origin main
```

## 3. Validate before pushing

```bash
npm install
npm run test
npm run build
```

## 4. Do not publish yet if these are still unresolved

- Final LICENSE / NOTICE files are missing
- Any blocked data asset has been copied in by mistake
- README and OPEN_STATUS are out of date
