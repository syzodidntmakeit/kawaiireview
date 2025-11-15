# KawaiiReview

Dark pastel, no-bullshit archive for the anime seasons and rap albums I actually care about. This repo is the full static prototype: HTML/CSS for the public site plus a collection of Node.js utilities that scaffold new reviews, download metadata/cover art, and keep the homepage and archive grids in sync.

## Directory Overview

| Path | Purpose |
| --- | --- |
| `index.html` | Landing page with two horizontally scrollable carousels (Anime + Albums). |
| `anime/` & `album/` | Each review gets its own slugged folder with `cover.*`, `blog.md`, and the generated HTML page (e.g., `album/madvillainy/madvillainy.html`). Each folder also contains `all-*.html`, which list every review in that medium. |
| `assets/css/style.css` | Shared Tailwind-style tokens and custom layout rules (carousels, archive grids, post typography). |
| `assets/js/main.js` | Populates the homepage carousels from `data/anime.json` & `data/albums.json`, hides scrollbars, and handles arrow paging. |
| `assets/js/archive.js` | Does the same for the `all-*.html` archive grids, with inline JSON fallbacks for local previews. |
| `templates/` | Mini templates for album/anime review pages. The build script injects Markdown+frontmatter into these. |
| `data/anime.json` & `data/albums.json` | Single source of truth for every entry (title, slug, cover path, created timestamp, link). The homepage and archive pages read from these files. |
| `scripts/` | Node utilities for scaffolding (`new_review.mjs`) and building (`build_entry.mjs`) reviews. |
| `new-album`, `new-anime`, `build`, `build-album`, `build-anime` | CLI wrappers that call the scripts above. |

## How the site stays up to date

1. **Dynamic data feeds** – The carousels and archive grids read from `data/*.json`. Every time a review is scaffolded or built, the JSON files are rewritten **and** the inline fallback `<script>` tags inside `index.html` and `all-*.html` are refreshed. That means the homepage + archives update as soon as the JSON changes, even when you’re viewing the site locally via `file://`.
2. **Single source for assets** – Anime covers live at `anime/<slug>/cover.jpg` (9:16 aspect). Albums live at `album/<slug>/cover.png` (1:1). The same assets are referenced by the cards, the archive grids, and the review pages, so nothing goes out of sync.
3. **Templates + Markdown** – Each review is stored as Markdown (`blog.md`) with YAML frontmatter (title, runtime, synopsis, score placeholder). The build script merges that file with the matching template and writes `<slug>.html`, so there’s no hand-maintenance of HTML.

## CLI Workflows (Node.js 18+)

### Scaffolding (`./new-anime` / `./new-album`)

```bash
./new-anime "Jujutsu Kaisen"
./new-album "Scaring the Hoes" --artist "JPEGMAFIA"
```

What happens:

1. The script prompts for the release year (if not provided via `--year`).
   - For albums, if you omit `--artist`, it will also ask for an optional artist name to improve the search.
2. It queries an external API:
   - **Anime** → [Jikan](https://jikan.moe/) (MyAnimeList data)
   - **Albums** → [TheAudioDB](https://www.theaudiodb.com/) (falls back to iTunes Search API if TheAudioDB has no match)
3. If multiple matches are found, it lists the top five so you can pick the correct one (or cancel). When only one match is returned, it asks for confirmation (`Is this what you're looking for? (Y/n): ...`).
4. On confirmation it auto-collects runtime metadata:
   - Albums: sums track lengths from TheAudioDB and stores total minutes + a formatted `Xh Ym` string.
   - Anime: records the reported total episode count and formats `1 Season • X Episodes` (or more, if the API returns it).
5. It creates `anime/<slug>/` or `album/<slug>/`, downloads the cover to `cover.ext`, writes `blog.md` with populated frontmatter (`runtime`, `seasons`/`episodes` or `length_minutes`, synopsis, etc.), and updates `data/*.json` plus the inline fallback `<script>` blocks so the homepage reflects the new entry immediately.

You can also call the script directly: `node scripts/new_review.mjs anime "Title" --year 2020`.

### Building (`./build <slug>`, `./build-anime`, `./build-album`)

After editing the Markdown review:

```bash
./build-anime jujutsu-kaisen
# or
./build scaring-the-hoes
```

The build script:

1. Detects whether the slug lives under `anime/` or `album/`.
2. Parses the frontmatter + Markdown body.
3. Injects everything into the appropriate template (`templates/anime.html` or `templates/album.html`), writing `<slug>.html` alongside `blog.md`.
4. Updates the matching JSON entry with the review link and refreshes the inline fallback data in `index.html` + `all-*.html`.

Once built, that entry appears on the homepage carousel (since it now has both `cover` & `link`), the archive grid, and is reachable at `/anime/<slug>/<slug>.html` or `/album/...`.

## Runtime metadata

The CLI automatically fills runtime details, but you can tweak them in `blog.md` if needed:

```yaml
runtime: "2 Seasons • 24 Episodes"
seasons: 2
episodes: 24
```

or for albums:

```yaml
length_minutes: 62
runtime: "1h 2m"
```

These values appear on the review page between the studio/artist line and the genre list.

## Tips & Notes

- The site is fully static—open `index.html` or use any static host (GitHub Pages, Netlify, etc.). Running a local server (`npx serve`, `python -m http.server`) is recommended so the fetch requests succeed; otherwise the inline fallback JSON handles rendering.
- Carousels use CSS `scroll-snap`. Keep card widths (`flex: 0 0 220px`) if you customize them.
- Only entries with both `cover` and `link` appear on the homepage and archive grids. Scaffolding creates the JSON record immediately; building adds the link.
- APIs used:
  - **Anime**: Jikan (MyAnimeList data)
  - **Albums**: TheAudioDB (demo API key `2`), with an automatic fallback to the iTunes Search API when TheAudioDB doesn’t return a match.

## Future Ideas

- Offer multiple API matches so you can pick if the first result isn’t right.
- Add tag filters / search to the archive grids.
- Auto-build all entries (`./build-all`) for one-shot regeneration.
- Consider migrating to a tiny static-site generator (Astro, Eleventy) if templates grow.

Until then: run `./new-…`, edit `blog.md`, run `./build-…`, and push to your static host. Fast, honest, biased—exactly how these opinions should live.
