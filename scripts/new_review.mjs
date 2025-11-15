#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const ANIME_DIR = path.join(ROOT, 'anime');
const ALBUM_DIR = path.join(ROOT, 'album');
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

const rl = readline.createInterface({ input, output });
const ask = async (prompt) => (await rl.question(prompt)).trim();

function slugify(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'entry';
}

function formatMinutes(minutes) {
  if (!Number.isFinite(minutes)) return '';
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function formatAnimeRuntime(seasons, episodes) {
  const parts = [];
  if (Number.isFinite(seasons) && seasons > 0) {
    parts.push(`${seasons} Season${seasons === 1 ? '' : 's'}`);
  }
  if (Number.isFinite(episodes) && episodes > 0) {
    parts.push(`${episodes} Episode${episodes === 1 ? '' : 's'}`);
  }
  return parts.join(' • ');
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function downloadImage(url, dest) {
  if (!url) return;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download image: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(dest, buffer);
}

async function fetchAnimeCandidates(title, year) {
  const params = new URLSearchParams({ q: title, limit: '5', order_by: 'score', sort: 'desc' });
  const response = await fetch(`https://api.jikan.moe/v4/anime?${params.toString()}`);
  if (!response.ok) throw new Error(`Jikan API error: ${response.status}`);
  const data = await response.json();
  let results = data?.data ?? [];
  if (!results.length) throw new Error(`No anime found for "${title}".`);
  if (year) {
    const filtered = results.filter((item) => item?.year === year);
    if (filtered.length) results = filtered;
  }
  return results.map((choice) => {
    const images = choice?.images?.jpg ?? {};
    const studios = (choice?.studios ?? []).map((s) => s.name).join(', ') || 'Unknown';
    const episodes = choice?.episodes ?? null;
    const seasons = choice?.seasons ?? 1;
    return {
      title: choice?.title || title,
      owner: studios,
      year: choice?.year,
      seasons,
      episodes,
      genres: (choice?.genres ?? []).map((g) => g.name).join(', '),
      synopsis: (choice?.synopsis ?? '').trim(),
      coverUrl: images.large_image_url || images.image_url || '',
      sourceUrl: choice?.url || '',
      runtime: formatAnimeRuntime(seasons, episodes),
    };
  });
}

async function fetchAlbumCandidates(title, year, artist) {
  const audioDb = await fetchAlbumFromTheAudioDb(title, year, artist);
  if (audioDb.length) return audioDb;
  const itunes = await fetchAlbumFromItunes(title, year, artist);
  if (itunes.length) return itunes;
  return [];
}

async function fetchAlbumFromTheAudioDb(title, year, artist) {
  const baseUrl = 'https://theaudiodb.com/api/v1/json/2/searchalbum.php';
  const params = new URLSearchParams();
  if (artist) params.set('s', artist);
  params.set('a', title);
  let data;
  try {
    const response = await fetch(`${baseUrl}?${params.toString()}`);
    if (!response.ok) return [];
    data = await response.json();
  } catch {
    return [];
  }
  let results = data?.album ?? [];
  if (!results.length) return [];
  if (year) {
    const filtered = results.filter((item) => Number(item?.intYearReleased) === year);
    if (filtered.length) results = filtered;
  }
  return results.map((choice) => {
    const coverUrl =
      choice?.strAlbumThumbHQ ||
      choice?.strAlbumThumb ||
      choice?.strAlbumCDart ||
      choice?.strAlbumSpine ||
      '';
    const minutes = Number(choice?.intDuration) ? Number(choice.intDuration) / 60 : undefined;
    return {
      title: choice?.strAlbum || title,
      owner: choice?.strArtist || artist || 'Unknown',
      year: Number(choice?.intYearReleased) || year,
      genres: choice?.strGenre || '',
      synopsis:
        choice?.strDescriptionEN ||
        `Auto-imported via TheAudioDB for ${choice?.strAlbum ?? title}. Replace with your synopsis.`,
      coverUrl,
      sourceUrl: choice?.strMusicBrainzID
        ? `https://musicbrainz.org/release/${choice.strMusicBrainzID}`
        : '',
      lengthMinutes: minutes,
      runtime: formatMinutes(minutes),
    };
  });
}

async function fetchAlbumFromItunes(title, year, artist) {
  const params = new URLSearchParams({
    term: artist ? `${title} ${artist}` : title,
    entity: 'album',
    limit: '10',
    country: 'us',
  });
  let data;
  try {
    const response = await fetch(`https://itunes.apple.com/search?${params.toString()}`);
    if (!response.ok) return [];
    data = await response.json();
  } catch {
    return [];
  }
  let results = data?.results ?? [];
  if (!results.length) return [];
  if (year) {
    const filtered = results.filter((item) => {
      const released = item?.releaseDate;
      if (!released) return false;
      return new Date(released).getFullYear() === year;
    });
    if (filtered.length) results = filtered;
  }
  if (artist) {
    const filtered = results.filter((item) =>
      (item?.artistName ?? '').toLowerCase().includes(artist.toLowerCase())
    );
    if (filtered.length) results = filtered;
  }
  const normalized = [];
  for (const choice of results) {
    let coverUrl = choice?.artworkUrl100 || '';
    if (coverUrl) {
      coverUrl = coverUrl.replace('100x100bb.jpg', '1000x1000bb.jpg');
    }
    let lengthMinutes;
    let runtimeLabel = '';
    if (choice?.collectionId) {
      try {
        const lookup = await fetch(
          `https://itunes.apple.com/lookup?id=${choice.collectionId}&entity=song`
        );
        if (lookup.ok) {
          const trackData = await lookup.json();
          const totalMillis = (trackData?.results ?? [])
            .filter((item) => item.wrapperType === 'track')
            .reduce((sum, track) => sum + (track.trackTimeMillis || 0), 0);
          if (totalMillis > 0) {
            lengthMinutes = Math.round((totalMillis / 60000) * 100) / 100;
            runtimeLabel = formatMinutes(lengthMinutes);
          }
        }
      } catch {
        // ignore
      }
    }
    normalized.push({
      title: choice?.collectionName || title,
      owner: choice?.artistName || artist || 'Unknown',
      year: choice?.releaseDate ? new Date(choice.releaseDate).getFullYear() : year,
      genres: choice?.primaryGenreName || '',
      synopsis: `Auto-imported via iTunes Search API for ${choice?.collectionName ?? title}. Replace with your synopsis.`,
      coverUrl,
      sourceUrl: choice?.collectionViewUrl || '',
      lengthMinutes,
      runtime: runtimeLabel || formatMinutes(lengthMinutes),
    });
  }
  return normalized;
}

function describeCandidate(kind, candidate) {
  const info = candidate.year ? `${candidate.year}` : 'n/a';
  return `${candidate.title} (${info}) by ${candidate.owner}`;
}

async function chooseCandidate(kind, candidates) {
  if (!candidates.length) throw new Error(`No ${kind} matches found.`);
  const describe = (c) => describeCandidate(kind, c);
  if (candidates.length === 1) {
    const summary = describe(candidates[0]);
    const confirm = (await ask(`Is this what you're looking for? (Y/n): ${summary}\n> `)).toLowerCase();
    if (confirm && !['', 'y', 'yes'].includes(confirm)) {
      console.log('Cancelled.');
      process.exit(0);
    }
    return candidates[0];
  }

  console.log(`Multiple ${kind} matches found:`);
  const limit = Math.min(candidates.length, 5);
  for (let i = 0; i < limit; i += 1) {
    console.log(`${i + 1}. ${describe(candidates[i])}`);
  }
  while (true) {
    const choice = await ask(`Select 1-${limit} (or press Enter to cancel): `);
    if (!choice) {
      console.log('Cancelled.');
      process.exit(0);
    }
    const index = Number(choice) - 1;
    if (Number.isInteger(index) && index >= 0 && index < limit) {
      return candidates[index];
    }
    console.log('Invalid selection.');
  }
}

async function collectRuntime(kind, meta) {
  if (kind === 'album') {
    if (!meta.runtime && Number.isFinite(meta.lengthMinutes)) {
      meta.runtime = formatMinutes(meta.lengthMinutes);
    }
  } else {
    if (!Number.isFinite(meta.seasons)) {
      meta.seasons = 1;
    }
    if (!meta.runtime) {
      const episodeCount = Number.isFinite(meta.episodes) ? meta.episodes : null;
      meta.runtime = formatAnimeRuntime(meta.seasons, episodeCount);
    }
  }
}

function buildFrontmatter({
  type,
  title,
  owner,
  year,
  genres,
  coverName,
  sourceUrl,
  synopsis,
  seasons,
  episodes,
  lengthMinutes,
  runtime,
}) {
  const timestamp = new Date().toISOString();
  const lines = [
    '---',
    `title: ${JSON.stringify(title)}`,
    `${type === 'album' ? 'artist' : 'studio'}: ${JSON.stringify(owner || '')}`,
    `year: ${year ?? ''}`,
    `genres: ${JSON.stringify(genres || '')}`,
    `cover: ${JSON.stringify(coverName)}`,
    `source_url: ${JSON.stringify(sourceUrl || '')}`,
    `created: ${JSON.stringify(timestamp)}`,
    `type: ${JSON.stringify(type)}`,
    `synopsis: ${JSON.stringify(synopsis || '')}`,
  ];

  if (type === 'album') {
    lines.push(`length_minutes: ${JSON.stringify(lengthMinutes ?? '')}`);
  } else {
    lines.push(`seasons: ${JSON.stringify(seasons ?? '')}`);
    lines.push(`episodes: ${JSON.stringify(episodes ?? '')}`);
  }

  lines.push(
    `runtime: ${JSON.stringify(runtime || '')}`,
    'score: null',
    '---',
    '',
    '## Review',
    '',
    'Write your review here...',
    '',
  );
  return lines.join('\n');
}

async function updateData(kind, entry) {
  await ensureDir(DATA_DIR);
  const dataPath = path.join(DATA_DIR, kind === 'anime' ? 'anime.json' : 'albums.json');
  let items = [];
  try {
    const raw = await fs.readFile(dataPath, 'utf8');
    items = JSON.parse(raw);
  } catch {
    items = [];
  }
  items = items.filter((item) => item.slug !== entry.slug);
  items.push(entry);
  items.sort((a, b) => new Date(a.created) - new Date(b.created));
  const jsonText = `${JSON.stringify(items, null, 2)}\n`;
  await fs.writeFile(dataPath, jsonText, 'utf8');
  await updateInlineScripts(kind, jsonText);
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
        // ignore missing file
      }
    })
  );
}

async function createReview(kind, meta) {
  const baseDir = kind === 'anime' ? ANIME_DIR : ALBUM_DIR;
  await ensureDir(baseDir);
  const slug = slugify(meta.title);
  const folder = path.join(baseDir, slug);
  try {
    await fs.access(folder);
    throw new Error(`Folder already exists: ${path.relative(ROOT, folder)}`);
  } catch {
    await fs.mkdir(folder, { recursive: true });
  }

  let coverExt = '.jpg';
  if (meta.coverUrl) {
    try {
      const parsed = new URL(meta.coverUrl);
      const ext = path.extname(parsed.pathname);
      if (ext) coverExt = ext.toLowerCase();
    } catch {
      // ignore invalid URL
    }
  }
  const coverName = `cover${coverExt}`;
  const coverPath = path.join(folder, coverName);
  if (meta.coverUrl) {
    console.log(`Downloading cover → ${path.relative(ROOT, coverPath)}`);
    await downloadImage(meta.coverUrl, coverPath);
  } else {
    await fs.writeFile(coverPath, '');
  }

  const markdown = buildFrontmatter({
    type: kind,
    title: meta.title,
    owner: meta.owner,
    year: meta.year,
    genres: meta.genres,
    coverName,
    sourceUrl: meta.sourceUrl,
    synopsis: meta.synopsis,
    seasons: meta.seasons,
    episodes: meta.episodes,
    lengthMinutes: meta.lengthMinutes,
    runtime: meta.runtime,
  });
  await fs.writeFile(path.join(folder, 'blog.md'), markdown, 'utf8');

  const coverRel = path.relative(ROOT, coverPath).replace(/\\/g, '/');
  const dataEntry =
    kind === 'anime'
      ? {
          slug,
          title: meta.title,
          year: meta.year,
          studio: meta.owner,
          cover: coverRel,
          link: null,
          created: new Date().toISOString(),
        }
      : {
          slug,
          title: meta.title,
          year: meta.year,
          artist: meta.owner,
          cover: coverRel,
          link: null,
          created: new Date().toISOString(),
        };
  await updateData(kind, dataEntry);

  console.log(`Created ${kind} review scaffold at ${path.relative(ROOT, folder)}`);
  console.log('- Markdown: blog.md');
  console.log('- Cover:', coverName);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        args[key] = true;
        i -= 1;
      } else {
        args[key] = value;
        i += 1;
      }
    } else {
      args._.push(token);
    }
  }
  return args;
}

async function run() {
  const argv = parseArgs(process.argv.slice(2));
  const [command, ...rest] = argv._;
  if (!['anime', 'album'].includes(command || '')) {
    console.error('Usage: ./new-anime "Title" [--year 2020] or ./new-album "Title" --artist "Artist" --year 2020');
    process.exit(1);
  }
  if (!rest.length) {
    console.error('Title is required (wrap it in quotes).');
    process.exit(1);
  }
  const title = rest.join(' ');
  let year = argv.year ? Number(argv.year) : undefined;
  if (!Number.isFinite(year)) {
    const answer = await ask('Release year (leave blank to skip): ');
    year = answer ? Number(answer) : undefined;
  }
  let artist = argv.artist;
  if (command === 'album' && !artist) {
    const artistAnswer = await ask('Artist name (optional): ');
    artist = artistAnswer || undefined;
  }
  try {
    let candidates =
      command === 'anime'
        ? await fetchAnimeCandidates(title, year)
        : await fetchAlbumCandidates(title, year, artist);
    if (!candidates.length) {
      throw new Error(`No ${command} results for "${title}".`);
    }
    const meta = await chooseCandidate(command, candidates);
    await collectRuntime(command, meta);
    await createReview(command, meta);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

run();
