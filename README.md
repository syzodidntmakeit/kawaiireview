# KawaiiReview

Dark pastel, no-bullshit archive for the anime seasons and rap albums I actually care about. This repo is both the front-end (static HTML/CSS/JS) and the tooling (Node scripts that scaffold metadata, download covers, and build finished review pages).

## Highlights

- **Cinematic post layout** – Every review page shares a framed hero: glowing cover, studio/artist pills, runtime chips, and a rounded SVG score ring that’s driven by CSS custom properties (no inline hacks).
- **Data-driven carousels** – `index.html` and the archive pages read from `data/anime.json` and `data/albums.json`. Inline JSON fallbacks keep everything working under `file://`.
- **Markdown-first authoring** – Reviews live in `blog.md` files with YAML frontmatter. The build script merges that content into HTML templates, so there’s zero copy/paste HTML work.
- **Smart scaffolding** – The CLI queries AniList + MusicBrainz (with Cover Art Archive) for metadata/cover art and falls back to Jikan, TheAudioDB, or iTunes when needed.

## Repo Layout

## Prerequisites

- Node.js 18+
- git (optional but recommended)
- Internet access for scaffolding (AniList + MusicBrainz + Cover Art Archive calls)

## Repo Layout

| Path | Purpose |
| --- | --- |
| `index.html` | Landing page with anime + album carousels, inline JSON fallbacks, and CTA/footer. |
| `anime/` / `album/` | One folder per review (`<slug>/blog.md`, `<slug>.html`, `cover.*`). Each medium also has `all-*.html` archive pages. |
| `assets/css/style.css` | Design tokens, layout rules (cards, hero, chips, score ring, typography). |
| `assets/js/main.js` | Carousel population + scroll controls, “back to top” button, and score-ring CSS variable sync. |
| `assets/js/archive.js` | Mirrors the carousel loader for archive grids. |
| `templates/` | HTML templates for anime/album posts. Build script swaps in Markdown + metadata. |
| `data/anime.json`, `data/albums.json` | Canonical lists of entries used by the homepage + archives. Updated automatically by the scripts. |
| `scripts/` | `kawaii.mjs` (command runner), `new_review.mjs` (scaffold), `build_entry.mjs` (render) + supporting modules. |

## CLI Commands (Node 18+)

Use the all-in-one helper (Node 18+, Internet access required for metadata):

```bash
# Scaffold
node scripts/kawaii.mjs new anime "Paranoia Agent" --year 2004
node scripts/kawaii.mjs new album "Scaring the Hoes" --artist "JPEGMAFIA"

# Build a single entry
node scripts/kawaii.mjs build anime paranoia-agent

# Build everything
node scripts/kawaii.mjs build-all        # anime + album
node scripts/kawaii.mjs build-all anime  # only anime
```

Under the hood:

1. **Anime metadata** comes from AniList’s GraphQL API (cover art, studios, air dates, synopsis). If AniList can’t find a match, the CLI falls back to Jikan.
2. **Album metadata** comes from MusicBrainz + the Cover Art Archive (canonical release info, tags, artwork). When that fails, TheAudioDB and iTunes serve as fallbacks.
3. The CLI prompts for optional score + score-caption, downloads cover art, writes `blog.md`, updates `data/*.json`, and refreshes the inline JSON used on `index.html` and the archive pages.

The legacy wrappers (`./new-anime`, `./new-album`, etc.) still work, but `scripts/kawaii.mjs` keeps everything in one place.

### Writing & tuning metadata

Open the generated `blog.md`, overwrite the review body, and tweak the frontmatter. Useful keys:

| Field | Description |
| --- | --- |
| `title`, `studio` / `artist`, `year`, `genres` | Self-explanatory. Comma-separated values become chips. |
| `runtime` | Freeform label that becomes a runtime chip (“1 Season × 26 Episodes”, “57 mins”). |
| `runtime_detail` | Sentence under the chips (“Aired Oct 1995 – Mar 1996”, “Released Nov 2021 · Republic”). |
| `score` | Number 0–10. Drives the SVG score ring (converted to a 0–1 ratio). Accepts strings like `TBD` if you don’t want a score yet. |
| `score_caption` | One-liner that sits under the score (“Blunted genius in 46 minutes.”). |
| `synopsis` | Long-form string shown in the synopsis column (Markdown paragraphs are converted to `<p>` blocks). |
| `seasons`, `episodes`, `length_minutes` | Optional numeric helpers; the CLI auto-fills them when available and the build script uses them to format runtimes. |

For anime you can also keep `seasons` / `episodes`; for albums you can store `length_minutes`. The build script prefers explicit `runtime` text, but will fall back to these numbers if needed.

### Building templates

`node scripts/kawaii.mjs build <anime|album> <slug>` calls `scripts/build_entry.mjs`, which parses `blog.md`, merges it with the matching template, writes `<slug>.html`, updates `data/*.json`, and refreshes the inline JSON fallbacks. `build-all` simply loops over every slug in `anime/` and `album/`.

## Styling & Components

- **Hero card** – `.post-hero` wraps the cover, metadata chips, runtime detail, and score block inside a frosted gradient panel. `.post-cover-anime` enforces a 9:16 crop; `.post-cover-album` keeps albums square.
- **Chips** – The build script converts comma-delimited strings into `<span class="meta-chip">…</span>` / `<span class="genre-chip">…</span>`. `.meta-chip-runtime` highlights runtimes in mint green, `.genre-chip` handles general tags.
- **Score ring** – `.post-score` exposes a `data-score` attribute. `assets/js/main.js` reads it and sets the CSS custom property `--score-value`, which powers the rounded SVG arc that wraps the numeric score.
- **Cards & grids** – The homepage carousels and archive grids use the same card component (`assets/css/style.css` around line 140). Keep cover aspect ratios consistent (`cover-portrait` for anime cards, `cover-square` for albums).

## Data Flow

1. `node scripts/kawaii.mjs new …` queries AniList/MusicBrainz for metadata, downloads cover art, writes `blog.md`, and updates `data/*.json` plus the inline `<script id="*-data-inline">` fallbacks embedded in `index.html` and the archive pages.
2. `node scripts/kawaii.mjs build …` parses `blog.md`, merges it with the correct template, writes `<slug>.html`, updates the JSON entries with the generated link, and refreshes the inline fallback data again.
3. `assets/js/main.js` fetches `data/*.json` when possible. If you’re opening the site via `file://`, network calls fail gracefully and the inline JSON (populated in step 1/2) acts as the source of truth.
4. Cards and archive grids read the same JSON entries, so once a generated HTML file exists they pick up the cover + link immediately.

For a “real” preview, run a static server at the repo root:

```bash
python -m http.server
# or
npx serve
```

## Scripts quick reference

| Command | Description |
| --- | --- |
| `node scripts/kawaii.mjs new anime "<title>" [--year 2020]` | Scaffold an anime review via AniList (Jikan fallback). |
| `node scripts/kawaii.mjs new album "<title>" --artist "Name"` | Scaffold an album via MusicBrainz (Cover Art Archive), fallback to TheAudioDB/iTunes. |
| `node scripts/kawaii.mjs build <anime|album> <slug>` | Regenerate a single review page. |
| `node scripts/kawaii.mjs build-all [anime|album|all]` | Rebuild every generated page in one go. |
| `node scripts/new_review.mjs` | Legacy scaffold script (still interactive). |
| `node scripts/build_entry.mjs <kind> <slug>` | Underlying build command used by the CLI/CI. |

Deploy by copying the repo (or at least `index.html`, `anime/`, `album/`, `assets/`, `data/`, and `LICENSE`) to any static host (GitHub Pages, Netlify, etc.). Everything else—covers, metadata, inline JSON—travels with the repo. Until then: scaffold, rant in Markdown, build, and push. Fast, honest, biased—exactly how these opinions should live.
