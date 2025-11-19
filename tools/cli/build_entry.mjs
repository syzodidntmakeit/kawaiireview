#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const ALBUM_DIR = path.join(ROOT, 'album');
const ANIME_DIR = path.join(ROOT, 'anime');
const DATA_DIR = path.join(ROOT, 'data');
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

function slugify(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    throw new Error('Missing frontmatter in blog.md.');
  }
  const [, front, body] = match;
  const data = {};
  front
    .split('\n')
    .filter(Boolean)
    .forEach((line) => {
      const [key, ...rest] = line.split(':');
      const value = rest.join(':').trim();
      if (!key) return;
      if (!value) {
        data[key.trim()] = '';
        return;
      }
      try {
        data[key.trim()] = JSON.parse(value);
      } catch {
        data[key.trim()] = value;
      }
    });
  return { data, body: body.trim() };
}

function paragraphize(text) {
  if (!text) return '<p></p>';
  const paragraphs = text.trim().split(/\n{2,}/);
  return paragraphs
    .map((p) => `<p>${p.trim().replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

function markdownToHtml(markdown) {
  if (!markdown) return '<p></p>';
  const blocks = markdown.split(/\n{2,}/);
  return blocks
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('## ')) {
        return `<h2>${trimmed.slice(3).trim()}</h2>`;
      }
      return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');
}

function formatAlbumRuntime(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return '';
  const total = Math.round(minutes);
  if (total < 60) return `${total} mins`;
  const hrs = Math.floor(total / 60);
  const mins = total % 60;
  const hourLabel = `${hrs} hr${hrs === 1 ? '' : 's'}`;
  if (mins === 0) return hourLabel;
  return `${hourLabel} ${String(mins).padStart(2, '0')} mins`;
}

function formatAnimeRuntimeDetails(seasons, episodes) {
  const seasonLabel =
    Number.isFinite(seasons) && seasons > 0 ? `${seasons} Season${seasons === 1 ? '' : 's'}` : '';
  const episodeLabel =
    Number.isFinite(episodes) && episodes > 0
      ? `${episodes} Episode${episodes === 1 ? '' : 's'}`
      : '';
  if (seasonLabel && episodeLabel) return `${seasonLabel} × ${episodeLabel}`;
  return seasonLabel || episodeLabel || '';
}

function formatRuntime(kind, data) {
  if (data.runtime) return data.runtime;
  if (kind === 'album') {
    const minutes = Number(data.length_minutes ?? data.minutes);
    return formatAlbumRuntime(minutes);
  }
  const seasons = Number(data.seasons ?? data.season_count ?? data.season);
  const episodes = Number(data.episodes ?? data.episode_count ?? data.total_episodes);
  return formatAnimeRuntimeDetails(seasons, episodes);
}

function splitList(value) {
  if (!value) return [];
  return value
    .split(/[,•|]/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function buildChipMarkup(tokens, className, fallback) {
  const items = tokens.length ? tokens : [fallback];
  return items
    .map((token) => `<span class="${className}">${token}</span>`)
    .join('\n          ');
}

async function updateInlineScripts(kind, jsonText) {
  const targets = INLINE_TARGETS[kind] || [];
  await Promise.all(
    targets.map(async ({ file, id }) => {
      try {
        const html = await fs.readFile(file, 'utf8');
        const pattern = new RegExp(`(<script id="${id}"[^>]*>)([\\s\\S]*?)(</script>)`);
        if (!pattern.test(html)) return;
        const updated = html.replace(pattern, `$1\n${jsonText.trim()}\n  $3`);
        await fs.writeFile(file, updated, 'utf8');
      } catch {
        // ignore
      }
    })
  );
}

async function updateDataLink(kind, slug, linkPath) {
  const dataPath = path.join(DATA_DIR, kind === 'album' ? 'albums.json' : 'anime.json');
  let items = [];
  try {
    const raw = await fs.readFile(dataPath, 'utf8');
    items = JSON.parse(raw);
  } catch {
    return;
  }
  const idx = items.findIndex((item) => item.slug === slug);
  if (idx === -1) return;
  items[idx].link = linkPath;
  const jsonText = `${JSON.stringify(items, null, 2)}\n`;
  await fs.writeFile(dataPath, jsonText, 'utf8');
  await updateInlineScripts(kind, jsonText);
}

function applyTemplate(template, replacements) {
  return Object.entries(replacements).reduce((html, [key, value]) => {
    const pattern = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    return html.replace(pattern, value ?? '');
  }, template);
}

async function buildEntry(kind, slugArg) {
  const slug = slugify(slugArg);
  const baseDir = kind === 'album' ? ALBUM_DIR : ANIME_DIR;
  const markdownPath = path.join(baseDir, slug, 'blog.md');
  await fs.access(markdownPath).catch(() => {
    throw new Error(`Could not find blog.md at ${path.relative(ROOT, markdownPath)}`);
  });

  const markdown = await fs.readFile(markdownPath, 'utf8');
  const { data, body } = parseFrontmatter(markdown);
  const templatePath = path.join(ROOT, 'templates', kind === 'album' ? 'album.html' : 'anime.html');
  const template = await fs.readFile(templatePath, 'utf8');

  const coverFile = data.cover || 'cover.jpg';
  const synopsisHtml = paragraphize(data.synopsis || '');
  const reviewHtml = markdownToHtml(body);
  const metaValue = kind === 'album' ? data.artist : data.studio;
  const runtimeDisplay = formatRuntime(kind, data);
  const metaTokens = splitList(metaValue);
  const metaChips = buildChipMarkup(metaTokens, 'meta-chip', 'Unknown');
  const metaChipsWithRuntime = runtimeDisplay
    ? `${metaChips}\n          <span class="meta-chip meta-chip-runtime">${runtimeDisplay}</span>`
    : metaChips;
  const genreChips = buildChipMarkup(splitList(data.genres), 'genre-chip', 'Uncategorized');
  const scoreNumber = Number.parseFloat(data.score);
  const scoreText = Number.isFinite(scoreNumber) ? scoreNumber.toFixed(1) : data.score || 'TBD';
  const scoreRatio = Number.isFinite(scoreNumber)
    ? Math.min(Math.max(scoreNumber / 10, 0), 1).toFixed(2)
    : '0';
  const scoreAria = Number.isFinite(scoreNumber)
    ? `Score ${scoreText} out of 10`
    : 'Unscored review';
  const coverClass =
    kind === 'anime' ? 'post-cover post-cover-anime' : 'post-cover post-cover-album';
  const replacements = {
    title: data.title || slugArg,
    cover_class: coverClass,
    cover: coverFile,
    eyebrow: data.eyebrow || (kind === 'anime' ? 'Anime review' : 'Album review'),
    meta_label: kind === 'anime' ? 'Studios' : 'Artists',
    meta_chips: metaChipsWithRuntime,
    runtime_detail: data.runtime_detail || '',
    genre_chips: genreChips,
    score_ratio: scoreRatio,
    score_text: scoreText,
    score_aria: scoreAria,
    synopsis: synopsisHtml,
    review: reviewHtml,
  };

  let html = applyTemplate(template, replacements);
  html = html.replace(/{{\s*year\s*}}/g, data.year ?? '');

  const folder = path.dirname(markdownPath);
  const outputName = `${slug}.html`;
  const outputPath = path.join(folder, outputName);
  await fs.writeFile(outputPath, html, 'utf8');

  const linkPath = path.posix.join(kind === 'album' ? 'album' : 'anime', slug, outputName);
  await updateDataLink(kind, slug, linkPath);
  console.log(`Built ${kind} page → ${path.relative(ROOT, outputPath)}`);
}

async function run() {
  const [, , kind, slug] = process.argv;
  if (!['album', 'anime'].includes(kind || '') || !slug) {
    console.error('Usage: node tools/cli/build_entry.mjs <album|anime> <slug>');
    process.exit(1);
  }
  try {
    await buildEntry(kind, slug);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

run();
