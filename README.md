# KawaiiReview

KawaiiReview is a stubbornly editorial archive for the anime seasons and rap albums I actually think about. It’s a pure-static site (HTML/CSS/JS) backed by a handful of Node scripts that fetch metadata, download cover art, scaffold Markdown, and build finished review pages.

---

## Quick Start

Requirements:

- Node.js 18+
- Git (optional, but useful for keeping history in sync)
- Internet access when scaffolding new reviews (the CLI talks to AniList, Jikan, MusicBrainz, Cover Art Archive, TheAudioDB, and iTunes)

Clone the repo, install dependencies if you plan to lint/format (not required for the core workflow), and run commands from the repo root.

```bash
git clone https://github.com/<you>/kawaiireview.git
cd kawaiireview
```

---

## CLI Commands

All automation runs through `tools/cli/kawaii.mjs`. Every command prints friendly errors if the input is missing or malformed.

| Command | Description |
| --- | --- |
| `node tools/cli/kawaii.mjs new anime "<title>" [--year YYYY] [--dry-run] [--overwrite]` | Scaffold an anime review. Fetches metadata from AniList (falls back to Jikan), grabs cover art, and writes `anime/<slug>/blog.md` + `cover.*`. |
| `node tools/cli/kawaii.mjs new album "<title>" --artist "<name>" [--dry-run] [--overwrite]` | Scaffold an album review via MusicBrainz + Cover Art Archive (fallbacks: TheAudioDB/iTunes). |
| `node tools/cli/kawaii.mjs build <anime|album> <slug>` | Merge `blog.md` with the appropriate template and emit `<slug>.html`. |
| `node tools/cli/kawaii.mjs build-all [anime|album|all]` | Rebuild every entry for the selected medium (or both). |
| `node tools/cli/kawaii.mjs list [anime|album|all]` | Print every review grouped under “Anime” and “Albums”, including slug and score (when present). |
| `node tools/cli/kawaii.mjs delete <anime|album> <slug>` | Remove a review folder, delete its HTML/blog/cover, prune the relevant JSON entry, and refresh the inline fallbacks. Prompts for confirmation (`Are you sure? (y|N)`). |

Legacy helpers (`new-anime`, `new-album`, etc.) still exist, but the consolidated CLI above is the happy path.

---

## Creating a Review (Step by Step)

1. **Scaffold metadata**
   ```bash
   node tools/cli/kawaii.mjs new anime "Neon Genesis Evangelion" --year 1995
   # or
   node tools/cli/kawaii.mjs new album "Scaring the Hoes" --artist "JPEGMAFIA"
   ```
   - The script prints multiple search matches if needed and lets you pick one.
   - `--dry-run` shows metadata without touching the filesystem.
   - `--overwrite` keeps the existing slug but replaces its files.

2. **Edit `blog.md`**
   - Each scaffold lives in `anime/<slug>/blog.md` or `album/<slug>/blog.md`.
   - The frontmatter contains every chip/metadata field (title, studio/artist, runtime, synopsis, score, etc.).
   - Replace the placeholder “## Review” section with your actual write-up. Markdown is converted to HTML during the build step.

3. **Generate the HTML**
   ```bash
   node tools/cli/kawaii.mjs build anime neon-genesis-evangelion
   ```
   - This writes `<slug>.html`, downloads cover art if it doesn’t exist, and updates `data/anime.json` / `data/albums.json` plus the inline `<script>` fallbacks used when browsing from `file://`.
   - `build-all` is handy after a big editing session.

4. **Preview locally**
   - Open `index.html` directly in a browser or run a static server:
     ```bash
     python -m http.server
     # or
     npx serve
     ```
   - Every review page is plain HTML, so GitHub Pages or any static host will Just Work. Deploy by committing and pushing, or by syncing the generated files to your hosting provider.

5. **Clean up or remove entries (optional)**
   - `node tools/cli/kawaii.mjs list` shows your catalog grouped by medium.
   - `node tools/cli/kawaii.mjs delete album lp` removes the `album/lp/` folder, its generated HTML, and the associated JSON records after a confirmation prompt.

---

## How the Code Works

### 1. Tooling pipeline

- `tools/cli/kawaii.mjs` – the command dispatcher (new/build/build-all/list/delete). Hands off work to the scripts below and keeps environment flags (`--dry-run`, `--overwrite`) in sync.
- `tools/cli/new_review.mjs` – interactive scaffolder. Talks to AniList/MusicBrainz + fallbacks, downloads cover art, writes `blog.md`, and updates `data/*.json` + inline `<script>` fallbacks embedded in the homepage and archive pages.
- `tools/cli/build_entry.mjs` – renders a single review. Reads `blog.md` frontmatter + Markdown, merges it with `templates/anime.html` or `templates/album.html`, writes `<slug>.html`, and refreshes the corresponding JSON entries (so cards/archives pick up the link + cover path).

### 2. Data flow

1. `new` command scaffold ➝ `blog.md`, `cover`, JSON entry.
2. `build` command ➝ `<slug>.html` and updated JSON link.
3. Front-end JS (`assets/js/main.js`) tries to `fetch("data/*.json")`. If the fetch fails (e.g., due to `file://`), it falls back to the inline `<script id="*-data-inline">` blobs that `new`/`build` keep updated.
4. Homepage carousels and archive grids read the same JSON, so any built review immediately surfaces everywhere without manual editing.

### 3. Front-end structure

- `index.html` – hero + carousels + inline data fallbacks.
- `anime/all-anime.html` / `album/all-album.html` – archive grids populated via the same JS loader.
- `templates/anime.html` / `templates/album.html` – the hero layout for individual reviews (cover on the left, score + metadata on the right, synopsis/review in collapsible sections).
- `assets/css/style.css` – tokens, layout, components (cards, chips, score ring, synopsis animation, responsive behaviors).
- `assets/js/main.js` – carousel init, “back to top” button, score ring CSS var sync, synopsis “see more” animation, nav toggle behavior.

---

## Project Layout

| Path | Purpose |
| --- | --- |
| `index.html` | Landing page with anime + album carousels and inline JSON fallbacks. |
| `anime/` / `album/` | One folder per review (`<slug>/blog.md`, `<slug>.html`, `cover.*`). Includes `all-*.html` archive pages. |
| `assets/css/style.css` | Global design (tokens, hero layout, cards, chips, synopsis animation, responsive tweaks). |
| `assets/js/main.js` | Carousel population, scroll controls, score ring logic, synopsis animation, nav toggle. |
| `data/anime.json` / `data/albums.json` | Canonical lists that feed the homepage + archives. Automatically updated by the scripts. |
| `templates/` | HTML templates for anime/album pages. |
| `tools/cli/` | CLI entry + build/scaffold scripts (`kawaii.mjs`, `new_review.mjs`, `build_entry.mjs`). |
| `assets/js/archive.js` | Archive grid population logic (mirrors the homepage loader). |

---

## Styling & Components

- **Hero card** – `.post-hero` wraps the cover, details, and score ring. On desktop the cover sits left, score under the metadata. On mobile the score floats beneath the cover and loses the background chrome for clarity.
- **Chips** – Studios/artists, runtime labels, and genres all use pill components with gradients defined near the `meta-chip` / `genre-chip` classes.
- **Score ring** – CSS variables drive the animated SVG arc (clamped to 0–10). The number is just the displayed score; captions were intentionally removed to keep the hero clean.
- **Synopsis** – Default view shows the first ~260px of text with a gradient fade. Clicking “See more” animates the same content open; clicking “See less” collapses it again.
- **Cards** – Carousels/archives share a single card style. Keep covers sized 220×? to avoid layout shifts.

---

## Future Plans

- **Search/filter UI** – Live filtering across anime + albums, with chips for studios/genres to fast-filter on the client.
- **RSS/JSON feed** – Auto-export the latest reviews (title, score, summary) for syndication.
- **Accessibility polish** – Better focus states, reduced-motion variants for the synopsis animation, and more descriptive aria labels on carousel controls.
- **Local preview server** – Simple dev command that watches `blog.md` and auto-rebuilds/reloads review pages.
- **CLI test harness** – Snapshot tests for the scaffold/build/delete commands so regressions are caught before shipping.
- **Optional image optimizer** – Script step to resize/compress covers for faster mobile loads.
- **CI hooks** – GitHub Actions workflow to run `build-all` + a static HTML linter before publishing to Pages.
- **Custom scrollbar** – Subtle themed scrollbars on desktop (respecting `prefers-reduced-motion`) so the UI looks consistent even in long review sections.

If you want to extend the project, start with the scripts—they’re well-contained and make it easy to plug in new metadata sources or change how the templates are rendered. Happy ranting.
