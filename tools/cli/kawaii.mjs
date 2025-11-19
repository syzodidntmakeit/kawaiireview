#!/usr/bin/env node
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'node:readline';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const ANIME_DIR = path.join(ROOT, 'anime');
const ALBUM_DIR = path.join(ROOT, 'album');

function printUsage() {
  console.log(`KawaiiReview CLI

Usage:
  node tools/cli/kawaii.mjs new <anime|album> "Title" [options]
  node tools/cli/kawaii.mjs build <anime|album> <slug>
  node tools/cli/kawaii.mjs build-all [anime|album|all]
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
  const file = path.join(dir, slug, 'blog.md');
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
    runNodeScript(path.join('tools', 'cli', 'build_entry.mjs'), [type, slug]);
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

const DATA_FILES = {
  anime: path.join(ROOT, 'data', 'anime.json'),
  album: path.join(ROOT, 'data', 'albums.json'),
};

const INLINE_TARGETS = {
  anime: [
    { file: path.join(ROOT, 'index.html'), id: 'anime-data-inline' },
    { file: path.join(ROOT, 'anime', 'all-anime.html'), id: 'anime-archive-data' },
  ],
  album: [
    { file: path.join(ROOT, 'index.html'), id: 'album-data-inline' },
    { file: path.join(ROOT, 'album', 'all-album.html'), id: 'album-archive-data' },
  ],
};

function readData(kind) {
  try {
    const raw = fs.readFileSync(DATA_FILES[kind], 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeData(kind, items) {
  const text = `${JSON.stringify(items, null, 2)}\n`;
  fs.writeFileSync(DATA_FILES[kind], text, 'utf8');
  const targets = INLINE_TARGETS[kind] || [];
  targets.forEach(({ file, id }) => {
    try {
      const html = fs.readFileSync(file, 'utf8');
      const pattern = new RegExp(`(<script id="${id}"[^>]*>)([\\s\\S]*?)(</script>)`);
      if (!pattern.test(html)) return;
      const updated = html.replace(pattern, `$1\n${text.trim()}\n  $3`);
      fs.writeFileSync(file, updated, 'utf8');
    } catch {
      // ignore missing inline targets
    }
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
  if (!fs.existsSync(folder)) {
    console.error(`No ${kind} review found for slug "${slug}".`);
    process.exit(1);
  }
  const meta = readFrontmatter(dir, slug);
  const title = meta.title || slug;
  const answer = (await prompt(`Delete ${title} (${kind})? Are you sure? (y|N) `)).toLowerCase();
  if (answer !== 'y' && answer !== 'yes') {
    console.log('Aborted.');
    return;
  }

  fs.rmSync(folder, { recursive: true, force: true });

  const data = readData(kind);
  const filtered = data.filter((entry) => entry.slug !== slug);
  if (filtered.length === data.length) {
    console.warn('Deleted files, but entry was not present in data JSON.');
  } else {
    writeData(kind, filtered);
  }

  console.log(`Removed ${kind} review "${title}" (${slug}).`);
}

async function main() {
  const argv = process.argv.slice(2);
  const [command, ...rest] = argv;

  if (!command) {
    printUsage();
    process.exit(1);
  }

  switch (command) {
    case 'new': {
      const [kind, ...rawArgs] = rest;
      if (!['anime', 'album'].includes(kind || '')) {
        console.error('Specify kind: anime or album.');
        process.exit(1);
      }
      const { flags, positional } = extractNewFlags(rawArgs);
      if (!positional.length) {
        console.error('Provide a title (wrap it in quotes).');
        process.exit(1);
      }
      const env = {};
      if (flags.dryRun) env.KAWAII_DRY_RUN = '1';
      if (flags.overwrite) env.KAWAII_OVERWRITE = '1';
    runNodeScript(path.join('tools', 'cli', 'new_review.mjs'), [kind, ...positional], env);
      break;
    }
    case 'build': {
      const [kind, slug] = rest;
      if (!['anime', 'album'].includes(kind || '') || !slug) {
        console.error('Usage: node tools/cli/kawaii.mjs build <anime|album> <slug>');
        process.exit(1);
      }
    runNodeScript(path.join('tools', 'cli', 'build_entry.mjs'), [kind, slug]);
      break;
    }
    case 'build-all': {
      const scope = rest[0] || 'all';
      if (!['anime', 'album', 'all'].includes(scope)) {
        console.error('Usage: node tools/cli/kawaii.mjs build-all [anime|album|all]');
        process.exit(1);
      }
      buildAll(scope);
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
