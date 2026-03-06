# Publishing Guide

This export is meant to become a separate public repository.

## 1. Refresh the export from the main workspace

```bash
npm run prepare:public-release
```

## 2. Create a repository from `public-release/`

```bash
cd public-release
git init
git add .
git commit -m "Initial public repository export"
```

## 3. Validate before pushing

```bash
npm install
npm run test -- --run
npm run build
```

Optional:

```bash
npm run test:e2e
```

## 4. Connect a remote

```bash
git remote add origin <YOUR_REMOTE_URL>
git branch -M main
git push -u origin main
```
