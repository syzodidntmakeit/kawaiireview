# KawaiiBlog Theme Study

This document reverse-engineers the styling decisions in this repo so they can be lifted into other projects (like the anime + hip-hop review hub you mentioned). I erred on the side of writing every observation, even when it's a hunch.

## Vibe Snapshot
- **Mood:** pastel-neon cyberpunk. Think dim midnight studio with LED strips rather than a bright shoujo diary. `body` is locked to a deep plum (`#0d011f`, `bg-custom-dark`) with warm gray text, so everything floats on a dark canvas.
- **Voice:** bold & cheeky. Heavy weight headers, uppercase microcopy, and the footer quip (“Don’t be a bitch”) lean casual but confident.
- **Structure:** Tailwind 3.4 + `@tailwindcss/typography` for content sections. Components rely on utility classes; no custom CSS beyond the base font/background, `gradient-text`, and layout helpers.
- **Flow:** Everything sits inside `.container` (`max-width: 1280px; padding: 0 1rem`). Pages stack sections with `space-y-12` or `py-12`, so the site feels roomy despite the dark palette.

## Color System

| Token                | Hex       | Used For / Notes                                                                                          |
|----------------------|-----------|-----------------------------------------------------------------------------------------------------------|
| `custom-dark`        | `#0d011f` | Page background. In daylight it reads eggplant; at night it tends toward indigo.                          |
| `kawaii-pink`        | `#FFC0CB` | Primary accent. Buttons, borders, uppercase labels, gradient start. Also used on nav active state.        |
| `kawaii-blue`        | `#A7C7E7` | Gradient end, archive nav hover, alternate accent.                                                        |
| `kawaii-mint`        | `#B2F2BB` | Hover color for “Search” + “About” nav links. Subtle, but enough to signal grouping.                      |
| `kawaii-lavender`    | `#E6E6FA` | Hover color for “Contact” nav link to imply softness.                                                     |
| `kawaii-coral`/`gold`/`sky`/... | Multiple | Available but not yet widely used; best candidates for differentiating anime vs hip-hop categories.        |
| Gray ramp            | Tailwind `gray-200/400/500/700/800` | Text + surfaces. Most cards are `bg-gray-800/50` with `border-gray-700` or `border-kawaii-pink`. |
| Social colors        | e.g. `#8B55CC` email, `#1D9BF0` twitter | Used as card borders + hover glows on `pages/contact.html`.                                                |

The gradient hero text uses `linear-gradient(45deg, #FFC0CB, #A7C7E7)` clipped to text. Because the body is dark, the pastel gradient still reads vibrant.

## Typography & Copy
- Base font: `'Nunito', sans-serif` imported from Google Fonts and assigned globally in `styles/tailwind.css`.
- Weights: 400, 700, 900. Headers lean on 900 (`font-black`). Body copy keeps weight 400 but uses `leading-relaxed`.
- Posts load `VT323` too, but I couldn’t find it applied yet—it’s likely planned for monospace callouts. Could use it for review score badges.
- Text treatments:
  - Uppercase mini labels w/ `tracking-[0.3em]` or `tracking-[0.4em]` (category tags, metadata) make things feel analog/dotted-matrix.
  - `prose prose-invert` handles blog content. Inverted palette ensures links, lists, etc., respect the dark theme without manual styling.
  - Hero statements are often `text-5xl` or `text-4xl` with `tracking-tight` or `tracking-tighter`.

## Layout & Spacing
- Every template wraps content in `.container mx-auto px-4 py-12`. On large displays you get ~1280px width; on phones the 1rem padding prevents edge collisions.
- Sections lean on `max-w-4xl mx-auto` for readable columns (about, archive, search, contact).
- Vertical rhythm: `space-y-6`, `space-y-12`, `mb-4/8/12`. There’s rarely less than `1.5rem` between sections, which keeps the vibe breathable.
- Cards use `p-6` (24px) or `p-8` (32px) padding with `rounded-lg` (~0.5rem radius). Avatar images use `rounded-full` and `ring-4`.
- Mobile nav toggles: header has `md:hidden` button + `hidden md:hidden` menu. Buttons rely on default 1rem padding.

## Component Breakdown

### Header & Navigation
- Layout: `flex justify-between items-center`. Title uses gradient text anchor.
- Desktop nav: `space-x-6 text-lg font-bold`. Each link gets a unique hover color per brand accent; JS adds `text-kawaii-pink` to the current page via `[data-nav]`.
- Mobile menu: simple list with `py-2 px-4`, `hover:bg-gray-700`, and `rounded`. Probably best to keep `bg-gray-700` for highlight to maintain contrast on dark backgrounds.

### Filter Buttons (Home)
- Buttons share `px-4 py-2 border border-kawaii-pink rounded-lg text-kawaii-pink bg-transparent`.
- Hover & active states invert colors: filled pink pill with `text-custom-dark`. JS toggles `active` to enforce this.
- Layout is `flex gap-2 flex-wrap`, so on narrow screens they wrap gracefully.

### Post Cards (Home, Archive, Search)
- Container: `block p-6 bg-gray-800/50 rounded-lg border border-kawaii-pink hover:bg-gray-700/50 transition-colors`.
- Title: `text-2xl font-bold text-kawaii-pink` (home/archive) or white (search results). Excerpts + meta text use `text-gray-400`.
- Search cards add a `flex justify-between` row w/ uppercase category label + light date.
- Loading state: `animate-spin rounded-full h-12 w-12 border-b-2 border-kawaii-pink` (Tailwind spinner).

### Individual Post Page
- Article container: `prose prose-invert lg:prose-xl` ensures consistent readability with 1.5× spacing and responsive typography.
- Metadata row uses `uppercase tracking` for category, muted `text-gray-400` for date, and pink tinted reading time.
- Background remains `bg-custom-dark`; no extra panels so the content rests directly on the background for immersion.

### Forms/Search Inputs
- Inputs: `px-4 py-3 rounded-lg bg-gray-800 text-gray-200 border border-gray-700 focus:border-kawaii-pink focus:outline-none transition-colors`.
- Buttons (sort, search action) typically `bg-gray-800/50 text-gray-300 hover:text-gray-100`, leaning on text-color shifts over background fills.
- This pattern can adapt to review filters: swap placeholder copy + icons but keep the focus glow to telegraph interactivity.

### Contact Grid / Social Tiles
- Grid: `grid grid-cols-1 md:grid-cols-2 gap-6`.
- Tiles: `bg-gray-800/50 p-6 rounded-lg border` with brand-color border + hover states:
  - `hover:bg-{social}/10`
  - `hover:shadow-[0_0_15px_rgba(color,0.5)]`
  - Title color shifts to the same brand color via `.group-hover`.
- Icons & headings align with `flex items-center mb-3`. Body copy sticks to `text-sm text-gray-400`.
- This is the freshest-looking section; reusing it for “Where to stream/watch/listen” cards on an entertainment site would be easy.

### Hero Avatar Block (About)
- Centered stack: `text-center mb-16`.
- Avatar: `w-48 h-48 rounded-full object-cover shadow-2xl ring-4 ring-kawaii-pink/30`. Gives a soft neon halo around the face.
- Headline: gradient text again, `text-5xl font-black`.
- Subtext: `text-xl text-gray-400`.

### Footer
- `text-center text-gray-500`, `mt-16`.
- Links get `underline hover:text-gray-300`.
- Copy spans two paragraphs with playful tone.

### Utility Pieces
- `#back-to-top` button: `fixed bottom-8 right-8` with pink background, dark text, bold type, `hover:bg-kawaii-blue`. Hidden until scroll > 300px, then fades in/out by toggling `hidden`.
- Mobile nav toggler uses a simple `stroke="currentColor"` hamburger icon, inherits text color (gray/pink).

## Interactions & Motion
- Hover states rely on `transition-colors` or `transition-all` (contact tiles) with 150–200ms default.
- Loader spinner uses Tailwind’s `animate-spin`; border-only spinner ties into pink accent.
- Smooth scroll for “Back to Top” uses `window.scrollTo({ behavior: 'smooth' })`.
- Mobile nav toggles via `.hidden` class, so no animation (could add `transition-max-height` if needed).
- Focus states lean on `focus:border-kawaii-pink`. There’s no custom focus ring, so forms depend on color shift—works on dark surfaces but consider `ring` utilities for accessibility in the new project.

## Implementation Notes
- Tailwind configuration extends `colors` with all pastel tokens and social colors. Because everything is defined there, using these classes in a new repo is as simple as copying `tailwind.config.js` + `styles/tailwind.css`.
- Base layer sets `body` font + background + text color, so you don’t need to sprinkle `bg-custom-dark` manually, though templates still set it on `<body>` for safety.
- `.container` is defined manually (max width + 1rem padding). This overrides Tailwind’s default container behavior, giving you consistent spacing without enabling the plugin.
- `gradient-text` is the only bespoke component class. It applies `font-black` plus the pastel gradient mask.
- Pages set `<html class="dark">` and rely on Tailwind’s dark mode variant for `prose-invert`. If you wanted light mode later, you’d toggle that class.

## Reuse Ideas for the Review Site
1. **Category Pills:** Replace “Tech/Commentary/etc.” with anime eras, genres, or album moods. Keep the pink default but use the unused palette slots (`kawaii-coral`, `kawaii-gold`, `kawaii-sky`) for genre-specific filters.
2. **Card Layout:** Each review card can mirror the home/archive card—title in accent color, meta line for release date + runtime/listening time, optional excerpt for your hot take.
3. **Score Badges:** That uppercase microcopy style + `tracking-[0.4em]` would make fun “S-tier” or rating badges, maybe paired with `VT323` for a retro scoreboard feel.
4. **Media Blocks:** The contact grid hover glow could become “Stream on” buttons or “Featured OST / Producer” callouts by swapping icons and brand colors.
5. **Hero Section:** Keep the gradient title + avatar block but swap the photo for cover art collage or a rotating carousel framed with the same ring effect.
6. **Palette Tweaks:** Because the background is so dark, even more saturated versions of the existing tokens will still look coherent. I’d keep `#0d011f` to maintain the moody vibe unless you specifically want a lighter anime aesthetic.

## Observational Odds & Ends
- I think the pastel palette is intentionally restrained to keep the darker grays from feeling lifeless—only one bright color is active per element to avoid rainbow overload.
- The consistent `px-4` horizontal padding screams “mobile first.” On ultrawide screens, sections will cap at 1280px, so no need to worry about readability.
- There’s no box-shadow on cards except contact tiles. The rest rely on borders + background luminosity difference (0.5 alpha). If you want more pop for review cards, adding `shadow-pink-500/20`-style glows would still align with the theme.
- Even though `VT323` is imported, it’s unused. I suspect it was meant for code snippets or low-fi headings. Could be perfect for “Listening Notes” or “Favorite Track” callouts.
- The repo already includes `kawaii-cream`, `kawaii-peach`, `kawaii-lilac`, etc., so the groundwork for more candy colors exists even if they’re silent right now.

Take this as a palette/style bible you can reference when rebuilding the theme around music/anime reviews. Let me know if you want me to rough out Tailwind components for the new project too.
