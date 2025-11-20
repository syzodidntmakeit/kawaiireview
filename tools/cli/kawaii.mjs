#!/usr/bin/env node
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'node:readline';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const ANIME_DIR = path.join(ROOT, 'src', 'content', 'anime');
const ALBUM_DIR = path.join(ROOT, 'src', 'content', 'album');

function printUsage() {
  console.log(`KawaiiReview CLI (Astro Edition)

Usage:
  node tools/cli/kawaii.mjs new <anime|album> "Title" [options]
  node tools/cli/kawaii.mjs dev
  node tools/cli/kawaii.mjs build
  node tools/cli/kawaii.mjs list [anime|album|all]
  node tools/cli/kawaii.mjs delete <anime|album> <slug>

Options for "new":
  --year <YYYY>       Release/Airing year filter
  --artist <Name>     Album artist (better search results)
  --dry-run           Fetch + preview metadata without writing files
  --overwrite         Replace an existing slug if it already exists
`);
}

function runNodeScript(scriptPath, args = [], env = {}) {
  const result = spawnSync('node', [scriptPath, ...args], {
    stdio: 'inherit',
    cwd: ROOT,
    env: { ...process.env, ...env },
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status);
  }
}

function runNpmCommand(command, args = []) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npm, [command, ...args], {
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
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

function parseFrontValue(raw) {
  const value = raw?.trim() ?? '';
  if (!value) return '';
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    try {
      return JSON.parse(value.replace(/^'/, '"').replace(/'$/, '"'));
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value === 'null') return null;
  const num = Number(value);
  if (!Number.isNaN(num)) return num;
  return value;
}

function readFrontmatter(dir, slug) {
  const file = path.join(dir, slug, 'index.md');
  try {
    const text = fs.readFileSync(file, 'utf8');
    const match = text.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return {};
    const meta = {};
    match[1]
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const idx = line.indexOf(':');
        if (idx === -1) return;
        const key = line.slice(0, idx).trim();
        const raw = line.slice(idx + 1);
        meta[key] = parseFrontValue(raw);
      });
    return meta;
  } catch {
    return {};
  }
}

function describeEntries(kind, slugs) {
  const dir = kind === 'anime' ? ANIME_DIR : ALBUM_DIR;
  return slugs.map((slug) => {
    const meta = readFrontmatter(dir, slug);
    return {
      slug,
      title: meta.title || slug,
      score: meta.score,
    };
  });
}

function extractNewFlags(args) {
  const flags = { dryRun: false, overwrite: false };
  const positional = [];
  args.forEach((arg) => {
    if (arg === '--dry-run') {
      flags.dryRun = true;
    } else if (arg === '--overwrite') {
      flags.overwrite = true;
    } else {
      positional.push(arg);
    }
  });
  return { flags, positional };
}

function listCommand(scope) {
  const sections = [];
  if (scope === 'anime' || scope === 'all') {
    sections.push(['Anime', describeEntries('anime', listSlugs(ANIME_DIR))]);
  }
  if (scope === 'album' || scope === 'all') {
    sections.push(['Albums', describeEntries('album', listSlugs(ALBUM_DIR))]);
  }
  if (!sections.length) {
    console.error('Usage: node tools/cli/kawaii.mjs list [anime|album|all]');
    process.exit(1);
  }
  sections.forEach(([label, entries]) => {
    console.log(`${label}:`);
    if (!entries.length) {
      console.log('  (none)');
      return;
    }
    entries
      .sort((a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }))
      .forEach(({ title, slug, score }) => {
        const numericScore = Number(score);
        const scoreLabel = Number.isFinite(numericScore) ? ` • Score ${numericScore.toFixed(1)}` : '';
        console.log(`  - ${title} (${slug})${scoreLabel}`);
      });
  });
}

async function prompt(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function deleteReview(kind, slug) {
  const dir = kind === 'anime' ? ANIME_DIR : ALBUM_DIR;
  const folder = path.join(dir, slug);

  let folderExists = false;
  try {
    await fs.access(folder);
    folderExists = true;
  } catch {
    // ignore
  }

  if (!folderExists) {
    console.error(`No ${kind} review found for slug "${slug}".`);
    return;
  }

  const meta = readFrontmatter(dir, slug);
  const title = meta.title || slug;

  const answer = (await prompt(`Delete ${title} (${kind})? Are you sure? (y/N) `)).toLowerCase();
  if (answer !== 'y' && answer !== 'yes') {
    console.log('Aborted.');
    return;
  }

  fs.rmSync(folder, { recursive: true, force: true });
  console.log(`Removed ${kind} review "${title}" (${slug}).`);
}

async function interactiveMenu() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

  while (true) {
    console.log('\nKawaiiReview CLI (Astro)');
    console.log('1. New Review');
    console.log('2. Start Dev Server');
    console.log('3. Build Site');
    console.log('4. List Reviews');
    console.log('5. Delete Review');
    console.log('6. Exit');

    const choice = (await ask('> ')).trim();

    if (choice === '1') {
      rl.close();
      runNodeScript(path.join('tools', 'cli', 'new_review.mjs'), []);
      return interactiveMenu();
    } else if (choice === '2') {
      rl.close();
      runNpmCommand('run', ['dev']);
      return interactiveMenu();
    } else if (choice === '3') {
      rl.close();
      runNpmCommand('run', ['build']);
      return interactiveMenu();
    } else if (choice === '4') {
      listCommand('all');
    } else if (choice === '5') {
      const kind = (await ask('Kind (anime/album): ')).trim();
      const slug = (await ask('Slug: ')).trim();
      if (kind && slug) {
        rl.close();
        await deleteReview(kind, slug);
        return interactiveMenu();
      }
    } else if (choice === '6') {
      rl.close();
      process.exit(0);
    } else {
      console.log('Invalid choice.');
    }
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const [command, ...rest] = argv;

  if (!command) {
    await interactiveMenu();
    return;
  }

  switch (command) {
    case 'new': {
      const [kind, ...rawArgs] = rest;
      const { flags, positional } = extractNewFlags(rawArgs);
      const env = {};
      if (flags.dryRun) env.KAWAII_DRY_RUN = '1';
      if (flags.overwrite) env.KAWAII_OVERWRITE = '1';
      const args = kind ? [kind, ...positional] : positional;
      runNodeScript(path.join('tools', 'cli', 'new_review.mjs'), args, env);
      break;
    }
    case 'dev': {
      runNpmCommand('run', ['dev']);
      break;
    }
    case 'build': {
      runNpmCommand('run', ['build']);
      break;
    }
    case 'list': {
      const scope = rest[0] || 'all';
      if (!['anime', 'album', 'all'].includes(scope)) {
        console.error('Usage: node tools/cli/kawaii.mjs list [anime|album|all]');
        process.exit(1);
      }
      listCommand(scope);
      break;
    }
    case 'delete': {
      const [kind, slug] = rest;
      if (!['anime', 'album'].includes(kind || '') || !slug) {
        console.error('Usage: node tools/cli/kawaii.mjs delete <anime|album> <slug>');
        process.exit(1);
      }
      await deleteReview(kind, slug);
      break;
    }
    default:
      printUsage();
      process.exit(1);
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
