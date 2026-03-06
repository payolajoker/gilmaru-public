#!/usr/bin/env node

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const projectRoot = process.cwd();
const args = process.argv.slice(2);
const hasNonAsciiPath = /[^\x00-\x7F]/.test(projectRoot);
const isWindows = process.platform === 'win32';

const EXCLUDED_TOP_LEVEL = new Set([
  '.git',
  'node_modules',
  'dist',
  'tmp',
  'output',
  '.playwright-cli'
]);

function run(command, commandArgs, cwd) {
  const result = process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', buildCmdLine(command, commandArgs)], {
      cwd,
      stdio: 'inherit'
    })
    : spawnSync(command, commandArgs, {
      cwd,
      stdio: 'inherit'
    });

  if (typeof result.status === 'number') return result.status;
  if (result.error) {
    console.error('[build-safe] process execution failed:', result.error.message);
  }
  return 1;
}

function buildCmdLine(command, commandArgs) {
  return [command, ...commandArgs.map(escapeCmdArg)].join(' ');
}

function escapeCmdArg(value) {
  const s = String(value);
  if (!/[ \t"]/u.test(s)) return s;
  return `"${s.replace(/"/g, '\\"')}"`;
}

async function copyProjectTo(workspaceRoot) {
  await fsp.mkdir(workspaceRoot, { recursive: true });
  const entries = await fsp.readdir(projectRoot, { withFileTypes: true });

  for (const entry of entries) {
    if (EXCLUDED_TOP_LEVEL.has(entry.name)) continue;
    const from = path.join(projectRoot, entry.name);
    const to = path.join(workspaceRoot, entry.name);
    await fsp.cp(from, to, { recursive: true });
  }
}

async function copyBuildOutput(workspaceRoot) {
  const srcDist = path.join(workspaceRoot, 'dist');
  const targetDist = path.join(projectRoot, 'dist');
  await fsp.rm(targetDist, { recursive: true, force: true });
  await fsp.cp(srcDist, targetDist, { recursive: true });
}

async function main() {
  if (!isWindows || !hasNonAsciiPath) {
    const exitCode = run('npx', ['vite', 'build', ...args], projectRoot);
    process.exit(exitCode);
  }

  const safeRoot = path.join(os.tmpdir(), 'gilmaru-build-safe');
  const workspaceRoot = path.join(safeRoot, 'workspace');

  console.log('[build-safe] Non-ASCII Windows path detected.');
  console.log(`[build-safe] Workspace: ${workspaceRoot}`);

  await fsp.rm(workspaceRoot, { recursive: true, force: true });
  await copyProjectTo(workspaceRoot);

  const installCode = run('npm', ['install', '--no-audit', '--no-fund'], workspaceRoot);
  if (installCode !== 0) {
    process.exit(installCode);
  }

  const buildCode = run('npx', ['vite', 'build', ...args], workspaceRoot);
  if (buildCode !== 0) {
    process.exit(buildCode);
  }

  if (!fs.existsSync(path.join(workspaceRoot, 'dist'))) {
    console.error('[build-safe] dist folder not generated.');
    process.exit(1);
  }

  await copyBuildOutput(workspaceRoot);
  console.log('[build-safe] dist copied back to project root.');
}

main().catch((error) => {
  console.error('[build-safe] build failed:', error);
  process.exit(1);
});
