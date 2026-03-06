import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { validatePointPack } from '../point-pack-validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

async function collectJsonFiles(targetPath) {
  const targetStat = await stat(targetPath);

  if (targetStat.isFile()) {
    return targetPath.endsWith('.json') ? [targetPath] : [];
  }

  const entries = await readdir(targetPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => collectJsonFiles(path.join(targetPath, entry.name)))
  );

  return files.flat();
}

export async function validatePointPackFile(filePath) {
  const raw = await readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  return validatePointPack(parsed);
}

async function main() {
  const rawTargets = process.argv.slice(2);
  const targets = rawTargets.length
    ? rawTargets.map((target) => path.resolve(process.cwd(), target))
    : [path.join(repoRoot, 'data', 'point-packs')];

  const files = (
    await Promise.all(targets.map((target) => collectJsonFiles(target)))
  ).flat();

  if (files.length === 0) {
    console.log('No point-pack JSON files found.');
    return;
  }

  let hasErrors = false;

  for (const filePath of files) {
    const relativePath = path.relative(repoRoot, filePath);

    try {
      const errors = await validatePointPackFile(filePath);
      if (errors.length === 0) {
        console.log(`OK  ${relativePath}`);
        continue;
      }

      hasErrors = true;
      console.error(`FAIL ${relativePath}`);
      errors.forEach((error) => console.error(`  - ${error}`));
    } catch (error) {
      hasErrors = true;
      console.error(`FAIL ${relativePath}`);
      console.error(`  - ${error.message}`);
    }
  }

  if (hasErrors) {
    process.exitCode = 1;
    return;
  }

  console.log(`Validated ${files.length} point-pack file(s).`);
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isDirectRun) {
  main();
}
