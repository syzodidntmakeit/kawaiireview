#!/usr/bin/env node
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ANIME_DIR = path.join(ROOT, 'anime');
const ALBUM_DIR = path.join(ROOT, 'album');

function printUsage() {
  console.log(`KawaiiReview CLI

Usage:
  node scripts/kawaii.mjs new <anime|album> "Title" [--year 2020] [--artist "Name"]
  node scripts/kawaii.mjs build <anime|album> <slug>
  node scripts/kawaii.mjs build-all [anime|album|all]
`);
}

function runNodeScript(scriptPath, args = []) {
  const result = spawnSync('node', [scriptPath, ...args], {
    stdio: 'inherit',
    cwd: ROOT,
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status);
  }
}

function listSlugs(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function buildAll(kind) {
  const targets = [];
  if (kind === 'anime' || kind === 'all') {
    listSlugs(ANIME_DIR).forEach((slug) => targets.push(['anime', slug]));
  }
  if (kind === 'album' || kind === 'all') {
    listSlugs(ALBUM_DIR).forEach((slug) => targets.push(['album', slug]));
  }
  if (!targets.length) {
    console.error('No matching entries to build.');
    process.exit(1);
  }
  targets.forEach(([type, slug]) => {
    console.log(`→ Building ${type} ${slug}`);
    runNodeScript(path.join('scripts', 'build_entry.mjs'), [type, slug]);
  });
}

const argv = process.argv.slice(2);
const [command, ...rest] = argv;

if (!command) {
  printUsage();
  process.exit(1);
}

switch (command) {
  case 'new': {
    const [kind, ...titleParts] = rest;
    if (!['anime', 'album'].includes(kind || '')) {
      console.error('Specify kind: anime or album.');
      process.exit(1);
    }
    if (!titleParts.length) {
      console.error('Provide a title (wrap in quotes).');
      process.exit(1);
    }
    runNodeScript(path.join('scripts', 'new_review.mjs'), [kind, ...titleParts]);
    break;
  }
  case 'build': {
    const [kind, slug] = rest;
    if (!['anime', 'album'].includes(kind || '') || !slug) {
      console.error('Usage: node scripts/kawaii.mjs build <anime|album> <slug>');
      process.exit(1);
    }
    runNodeScript(path.join('scripts', 'build_entry.mjs'), [kind, slug]);
    break;
  }
  case 'build-all': {
    const scope = rest[0] || 'all';
    if (!['anime', 'album', 'all'].includes(scope)) {
      console.error('Usage: node scripts/kawaii.mjs build-all [anime|album|all]');
      process.exit(1);
    }
    buildAll(scope);
    break;
  }
  default:
    printUsage();
    process.exit(1);
}
