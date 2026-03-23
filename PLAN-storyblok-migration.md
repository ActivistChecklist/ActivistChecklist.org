# Plan: Migrate Off Storyblok to File-Based Content

## Context

ActivistChecklist.org stores all content in Storyblok CMS (231 stories across 17 component types, max 4 levels of nesting). The goal is to move everything into the GitHub repo as human-editable MDX files, eliminating the Storyblok dependency. This gives contributors direct access to content via Git, removes a third-party dependency, and enables offline editing. A visual editing layer (TinaCMS or equivalent) will be added in a future phase.

---

## Content Inventory (from Storyblok API query)

| Type | Count | Target format |
|------|-------|--------------|
| news-item | 132 | MDX |
| checklist-item | 42 | MDX |
| news-source | 19 | MDX |
| changelog-entry | 14 | MDX |
| guide | 13 | MDX |
| page | 11 | MDX |
| **Total** | **231** | |

17 component types total. Embedded-in-richtext: alert, button, how_to, image_embed, video_embed, risk_level, table. Max blok nesting depth: 2 (verified by API scan — see Edge Cases section).

**Everything is MDX** for consistency across the whole system.

---

## File Formats

### Checklist Items (`content/checklist-items/{slug}.mdx`)

42 files. Only `body` is richtext → MDX body. All other fields are plain strings → frontmatter.

```mdx
---
title: "Use Signal for encrypted texts and calls"
slug: signal
type: checkbox
why: "Normal calls and texts are not private"
tools: "Use Signal"
stop: "Use Facebook Messenger, Telegram, regular texts"
titleBadges: []
---

Body content in markdown with embedded components...

<Alert type="warning" title="Important">

Alert body goes here. Supports full markdown.

</Alert>

<HowTo title="How to install Signal">

1. Go to signal.org
2. Install the app

</HowTo>
```

### Guides (`content/guides/{slug}.mdx`)

13 files. The full guide structure lives in the MDX body. Section components explicitly group their checklist items. Checklist items are always referenced by slug — resolved at build time.

```mdx
---
title: "Signal Security"
slug: signal
image: /images/guides/signal.png
lastUpdated: "2026-01-29"
estimatedTime: "20 minutes"
summary: "Configure Signal for maximum privacy and security."
---

This guide walks you through the most important Signal settings.

<Section title="Hide your identity on Signal" slug="hide-identity">

<RiskLevel level="everyone" />

<ChecklistItemRef ref="use-signal" />
<ChecklistItemRef ref="share-signal-username" />

</Section>

<Section title="Protect your messages & calls" slug="protect-messages">

<RiskLevel level="everyone" />

<ChecklistItemRef ref="signal-disappearing-messages" />
<ChecklistItemRef ref="signal-screen-lock" />

</Section>

<RelatedGuides guides={["essentials", "protest"]} />
```

**Ref resolution**: `getStaticProps` extracts all `ChecklistItemRef ref="..."` from MDX source, loads each item's MDX, serializes them, and passes a `resolvedItems` map via React context.

### Pages (`content/pages/{slug}.mdx`)

11 files (excluding home, which is a custom Next.js page).

```mdx
---
title: "About"
slug: about
image: /images/pages/about.png
---

Page body with optional embedded components...

<Button title="Contact us" url="/contact" variant="default" />
```

### News Items (`content/news/{year}/{slug}.mdx`)

132 files, grouped by year. Comment richtext → MDX body.

```mdx
---
title: "FBI Expands Surveillance of Protest Groups"
date: "2025-03-10"
url: "https://example.com/article"
source: the-intercept
hasPaywall: false
---

Concerning development. See our [protest guide](/protest).
```

### News Sources (`content/news-sources/{slug}.mdx`)

19 files. Frontmatter only, no body.

```mdx
---
name: "The Intercept"
slug: the-intercept
url: "https://theintercept.com"
---
```

### Changelog Entries (`content/changelog/{date}-{slug}.mdx`)

14 files. Body is richtext → MDX body.

```mdx
---
type: major
date: "2025-03-15"
slug: march-2025-update
---

Added new [protest safety guide](/protest) with updated recommendations.
```

---

## Directory Structure

```
content/
  checklist-items/     # 42 MDX files
  guides/              # 13 MDX files
  pages/               # 11 MDX files
  news/
    2024/              # MDX files grouped by year
    2025/
    2026/
  news-sources/        # 19 MDX files
  changelog/           # 14 MDX files
```

---

## MDX Security: Defense in Depth

MDX compiles to JavaScript, making it inherently unsafe for untrusted input. CVE-2026-0969 demonstrated full RCE through malicious MDX in `next-mdx-remote`. Since this is an activist security site accepting content PRs, defense in depth is essential.

### Layer 1: CI Validation (pre-merge gate)

A build-time script (`scripts/validate-content.mjs`) that scans all MDX files:

- **Regex scan** for suspicious patterns: `import`, `export`, `require()`, `eval()`, `Function()`, `process.`, `dangerouslySetInnerHTML`, `javascript:` URLs, `on*` event handlers, `<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `data:text/html`
- **AST validation** via MDX compilation with custom remark plugins that reject:
  - `mdxjsEsm` nodes (import/export statements)
  - `mdxFlowExpression` / `mdxTextExpression` nodes (JS expressions in `{}`)
  - Unregistered component names (only allowlisted components pass)
  - Event handler attributes on any element
- **Fails the CI check** if any violations found

### Layer 2: Compilation-time restrictions

- `next-mdx-remote` v6.0.0+ with `blockJS: true` (default — blocks all JS expressions)
- Custom remark plugins to strip/reject ESM imports and JS expressions at AST level
- `rehype-sanitize` to strip dangerous HTML attributes from output
- `remark-mdx-remove-esm` as additional belt-and-suspenders

### Layer 3: Rendering-time restrictions

- Only explicitly allowlisted components via the `components` prop on `MDXRemote`
- Override dangerous HTML elements to render nothing: `script: () => null`, `iframe: () => null`, `object: () => null`, `embed: () => null`
- `SafeLink` component that validates URLs and strips `javascript:` protocol
- Component prop validation (e.g., Button validates `url` prop)

### Layer 4: Human review

- CODEOWNERS file requiring trusted maintainer approval for `content/` changes
- GitHub Action that annotates PR diff with MDX-specific warnings

---

## CMS Compatibility: Designing for the Future

Research findings on git-based CMS options:

| Feature | TinaCMS | Keystatic | Decap CMS |
|---------|---------|-----------|-----------|
| Pages Router | **Yes** | No (App only) | Yes |
| MDX Support | **Yes** | **Yes** | No |
| Nested Components | Partial (fragile at depth >1) | **Yes** (wrapper/repeating) | No |
| Cross-refs in rich-text | **No** (closed wontfix) | Not documented | N/A |
| Self-hostable | **Yes** (free) | **Yes** (free) | **Yes** |

**Key risks with TinaCMS:**
- Known data-loss bugs with deeply nested rich-text (issue #2581, closed wontfix)
- Reference fields inside rich-text templates not supported (issue #3050, wontfix)
- Our `ChecklistItemRef` pattern (guide referencing items from another collection) would need string-slug workaround

**Design decisions to stay CMS-compatible:**

1. **Keep nesting shallow (max 1 level deep)** in MDX components. A `<Section>` wraps flat content and `<ChecklistItemRef>` blocks. A `<HowTo>` contains markdown but not other block components. An `<Alert>` contains markdown but not other block components. This is how the content actually works today — the apparent 4-level depth is richtext-within-a-component, not component-within-component-within-component.

2. **Use string refs for cross-collection content.** `<ChecklistItemRef ref="use-signal" />` uses a slug string, resolved at build time. Every CMS can edit a string field.

3. **Frontmatter for all metadata.** All CMS tools parse YAML frontmatter easily.

4. **Use `.mdx` extension.** TinaCMS, Keystatic, CloudCannon all treat `.mdx` differently from `.md`.

5. **The guide `<Section>` / `<ChecklistItemRef>` structure** is the hardest part for any CMS. If TinaCMS can't handle it visually, guides can remain code-edited (they change less frequently) while simpler content types (checklist items, pages, news) get visual editing.

**If we move to App Router in the future**, Keystatic becomes viable and its content component model (wrapper/block/repeating types) is the best fit for our architecture.

---

## Querying: File-System Reads (No GraphQL Needed)

The content set is small (231 items) and all queries happen at build time. Simple file-system reads in `lib/content.js` are sufficient:

```javascript
// Examples of what lib/content.js provides:
getAllGuides()              // Read all MDX files in content/guides/
getGuideBySlug(slug)       // Read specific guide + resolve ChecklistItemRefs
getChecklistItem(slug)     // Read specific checklist item
getAllNewsItems()           // Read all news MDX files, sorted by date
getAllChangelogEntries()    // Read all changelog MDX files, sorted by date
getAllSlugs()               // For getStaticPaths
```

No GraphQL needed. When TinaCMS is added later, it provides its own GraphQL layer that can optionally replace these functions.

---

## Architecture Changes

### New files to create

| File | Purpose |
|------|---------|
| `lib/content.js` | Build-time content loading — reads MDX files, parses frontmatter, replaces all Storyblok API calls |
| `lib/mdx-components.js` | Central MDX component map + dangerous element overrides |
| `lib/mdx-options.js` | Shared MDX compilation options (remark/rehype plugins, security config) |
| `contexts/ChecklistItemsContext.js` | React context for resolved checklist items within a guide |
| `scripts/migrate-from-storyblok.mjs` | One-time migration script |
| `scripts/validate-content.mjs` | MDX security validation (CI + pre-commit) |

### Key files to modify

| File | Change |
|------|--------|
| `pages/[...slug].js` | Rewrite getStaticProps/getStaticPaths to read from files |
| `pages/_app.js` | Remove storyblokInit, bridge code, component registry |
| `pages/index.js`, `news.js`, `changelog.js`, `checklists.js` | Rewrite getStaticProps |
| `components/guides/Guide.js` | Accept resolved guide data; sections now explicit in MDX |
| `components/guides/ChecklistItem.js` | Accept frontmatter + bodyMdx instead of `blok`; slug-based localStorage keys |
| `components/pages/Page.js` | Accept file-based props |
| Embedded components (HowTo, ButtonEmbed, ImageEmbed, VideoEmbed, RiskLevel, etc.) | Remove `storyblokEditable`, accept plain props |
| `utils/core.js` | Remove Storyblok-specific utilities |
| `scripts/generate-rss.mjs`, `generate-og-images.mjs` | Read from files |

### Files to delete

- `components/RichText.js` — Replaced by MDXRemote + component map
- `components/guides/ChecklistItemRef.js` — Merged into content layer + MDX component
- `components/guides/ChecklistItemReference.js` — Merged into content layer
- `scripts/export-stroyblok.mjs` — Storyblok export CLI
- `scripts/export-library.js` — Storyblok export orchestrator
- `scripts/export-yaml.js` — Storyblok YAML converter
- `scripts/export-image-handler.js` — Storyblok media downloader
- `scripts/export-management-api.js` — Storyblok Management API export
- `scripts/fetch-news-images.js` — Storyblok-dependent news image fetcher (replaced by local version)

### Dependencies

- **Remove**: `@storyblok/react`, `storyblok-rich-text-react-renderer`, `storyblok-js-client`, `storyblok-backup`
- **Add**: `next-mdx-remote` (v6+), `gray-matter`, `rehype-sanitize`, `remark-mdx-remove-esm`
- **Keep**: `js-yaml` (move to prod deps), `remark-gfm`

---

## Asset Migration

### Asset Inventory (from Storyblok API scan — 22 unique CDN URLs)

**PDFs (4 files):**
- `activistchecklist-flyer-4up.pdf` — flyer page
- `activistchecklist-flyer-single.pdf` — flyer page
- `police-at-the-door-poster-activistchecklist-org-v4.pdf` — police page (English)
- `police-at-the-door-spanish-activistchecklist.pdf` — police page (Spanish)

**Images (17 files):**
- 2 inline content images (signal phishing: `real-fake-signal.jpg`, `signal-phishing.png`)
- 2 page content images (flyer: `activistchecklist-flyer-both-sides.png`, police: `police-at-the-door-poster...v4.png`)
- 1 image embed (links page: `link-sharing-dont-make-me-tap-the-sign.jpg`)
- 1 share image (links page: `dont-make-me-tap-the-sign-share.jpg`)
- 1 welcome image (`welcome.jpg`)
- 10 news `image_override` images (`ice-threatening-observers.jpg`, `doxxing-canary.jpeg`, `tech-ice-02-superjumbo-large.jpeg`, `forbes.webp`, `ice-enter-without-warrant.webp`, `flock.jpg`, `elon-musk-doxxing...jpg`, `exxon-lobbyist...jpg`, `privacy-advocates-ice...jpg`, `ice-mn.webp`)

**Video (1 file):**
- `dont-say-anything-song-bread-and-puppet-theater-tiktok-planetslushy.mp4` — police page

**Already local (keep as-is):**
- `public/files/news/` — 135 resized news article images + `image-manifest.json` (managed by existing `fetch-news` pipeline)
- `public/files/downloads/` — 1 .docx (emergency planning worksheet)
- `public/files/zines/` — 6 PDF zines (essentials, signal, secondary phone — print & read versions)
- `public/images/` — logos, OG images

**External links (no migration needed):**
- 1 button links to Proton Drive (emergency planning worksheet alternate)

### Migration approach for assets

1. **Download 22 Storyblok CDN files** to appropriate local directories:
   - PDFs → `public/files/downloads/`
   - Content images (inline, embeds, hero) → `public/images/content/`
   - News override images → `public/files/news/`
   - Video → `public/files/videos/`
2. **Strip metadata** from all downloaded files using existing `metadata-cli.cjs` logic
3. **Rewrite all `a-us.storyblok.com` URLs** in MDX content to local paths
4. **Leave existing local references unchanged** (`/files/downloads/`, `/files/zines/`, `/files/news/`)
5. **News images**: The 135 news images in `public/files/news/` stay where they are — managed by the existing `fetch-news` pipeline. The 10 news `image_override` URLs on Storyblok CDN get downloaded and added to the local news images directory
6. **Validate** all image/file paths resolve to existing files after migration
7. **Button `download` prop** preserved in MDX: `<Button title="..." url="/files/downloads/..." download />`

---

## Content Edge Cases (from API scan of all 232 stories)

### Multiple richtext fields per block

Only one component type has >1 richtext field: **`guide`** (has both `body` and `summary`). All 13 guides have this pattern.

**Handling**: `summary` is always a single paragraph with no embedded bloks (max ~238 chars). Safe to convert to a plain string in frontmatter during migration. The migration script extracts plain text from the richtext `summary` field. If a summary contains marks (bold, links), fall back to storing it as a short MDX string in frontmatter.

### Section-header `description` is richtext with embedded bloks

This is the most important edge case. In Storyblok, `section-header.description` is a richtext field that frequently contains embedded blok components:

- **`risk_level`** bloks appear in 20 section-headers across 10 guides. These have their own `body` richtext (up to ~156 chars of text, no further nested bloks).
- **`alert`** bloks appear in 5 section-headers across 3 guides (doxxing, spyware, research). These have `body` richtext (up to ~549 chars, no further nested bloks).

**Handling in MDX**: The `<Section>` component wraps its description content directly. Risk levels and alerts are child components of the section:

```mdx
<Section title="Baseline protections" slug="baseline">

<RiskLevel level="everyone">

Everyone should take these basic steps.

</RiskLevel>

<Alert type="info" title="Note">

Some additional context here.

</Alert>

<ChecklistItemRef ref="use-signal" />
<ChecklistItemRef ref="strong-passwords" />

</Section>
```

This keeps nesting at 1 level (`Section` → `RiskLevel`/`Alert`/`ChecklistItemRef`). The `RiskLevel` and `Alert` body content is markdown text, not further components.

### Actual nesting depth: max 2 (not 4)

Previous estimate of 4 levels was based on theoretical component schema. Actual API scan of all content shows **max depth is 2**:

| Nesting chain | Occurrences | Example stories |
|--------------|-------------|-----------------|
| `body > how_to.body > alert` | 7 | learn-how-to-disable-biometrics, proton-docs, opt-out-of-face-search-sites, ice, doxxing, travel (x2) |
| `body > how_to.body > button` | 5 | scrub-your-private-data, create-your-emergency-plan, organizing, protest, essentials |

No depth-3 chains exist anywhere in the content. All `alert` and `button` bloks inside `how_to.body` contain only text — no further embedded bloks.

**Handling in MDX**: Straightforward nesting:

```mdx
<HowTo title="How to disable Face ID quickly">

1. Press side button + volume button simultaneously
2. Continue holding until "Emergency SOS" slider appears

<Alert type="warning" title="Important">

This only works on iPhone X and later.

</Alert>

<Button title="Apple Support Article" url="https://support.apple.com/..." />

</HowTo>
```

### image_embed and video_embed captions

Both `image_embed` (links page) and `video_embed` (police page) have richtext `caption` fields. In practice, captions contain only plain text — no embedded bloks.

**Handling**: Caption becomes a prop or child content:

```mdx
<ImageEmbed src="/images/content/link-sharing.jpg" alt="Share guide links">

Caption text goes here as markdown children.

</ImageEmbed>
```

### Summary of edge case risk

All edge cases are well-covered by the planned MDX format. The key insight is that actual content nesting is much shallower than what the schema allows. No changes to the planned architecture are needed.

---

## Scripts: Remove vs. Preserve

### Scripts to REMOVE (Storyblok export/media gathering)

| Script | Purpose |
|--------|---------|
| `scripts/export-stroyblok.mjs` | CLI wrapper for Storyblok export pipeline |
| `scripts/export-library.js` | Main export orchestrator (fetch stories, convert, download media) |
| `scripts/export-yaml.js` | Converts Storyblok stories to YAML format |
| `scripts/export-image-handler.js` | Downloads media from Storyblok CDN + strips metadata |
| `scripts/export-management-api.js` | Exports stories via Storyblok Management API |
| `scripts/fetch-news-images.js` | Fetches news from Storyblok, scrapes OG images, resizes + strips metadata |

**npm scripts to remove** from `package.json`:
- `prestoryblockexport`, `storyblockexportimages`, `storyblockexportcontent`
- `fetch-news` (depends on Storyblok API for news item list)

**Note**: `export-image-handler.js` and `fetch-news-images.js` both use the metadata stripping library. The metadata stripping logic is independently available via `metadata-cli.cjs` and `pre-commit-metadata.cjs`, so removing these scripts loses no capability.

### Scripts to PRESERVE (metadata scrubbing + other)

| Script | Purpose |
|--------|---------|
| `scripts/metadata-cli.cjs` | Standalone CLI for scanning/stripping metadata from images, PDFs, videos |
| `scripts/pre-commit-metadata.cjs` | Git pre-commit hook that auto-strips metadata from staged media files |
| `scripts/utils.js` | Shared utilities (logger, hash, progress) — used by preserved scripts |
| `scripts/build-backup.js` | Build directory backup rotation |
| `scripts/generate-rss.mjs` | RSS feed generation (will be modified to read from files) |
| `scripts/generate-og-images.mjs` | OG image generation (will be modified to read from files) |
| `scripts/check-build.mjs` | Build verification |
| `scripts/check-links.mjs` | Link checker |
| `scripts/build-search-index.sh` | Search index generation |
| All other non-export scripts | Unrelated to Storyblok |

### Post-migration: `fetch-news` pipeline replacement

The `fetch-news-images.js` script currently:
1. Fetches news items from Storyblok API
2. Scrapes OG images from article URLs
3. Resizes and strips metadata
4. Generates `image-manifest.json`

After migration, a replacement script (`scripts/fetch-news-images-local.mjs`) will:
1. Read news items from `content/news/**/*.mdx` files instead of Storyblok
2. Steps 2-4 remain identical

---

## Migration Script (`scripts/migrate-from-storyblok.mjs`)

1. **Fetch** all 231 stories from Storyblok API (reuse existing `scripts/export-library.js` logic)
2. **Convert richtext JSON → MDX**:
   - Text marks (bold, italic, links, code) → Markdown
   - Block nodes (paragraphs, headings, lists) → Markdown
   - `blok` nodes → MDX component tags (`<Alert>`, `<HowTo>`, `<Button>`, etc.)
   - Recursive conversion for nested richtext in blok children
   - `{className}text{/}` custom syntax → `<span className="...">text</span>`
   - `<InlineChecklist>` text markers → proper JSX wrappers
   - Storyblok link objects → plain URLs
   - Storyblok image objects → local paths
3. **Extract inline checklist items** from guide blocks into their own MDX files
4. **Convert guides** to MDX with `<Section>` / `<ChecklistItemRef>` components
5. **Download images** from Storyblok CDN → `public/images/content/`
6. **Validate** all cross-references resolve, no broken links/images, no orphaned items
7. **Generate report** summarizing what was converted and any issues

---

## Comparison Testing (Automated, Temporary)

This testing code is temporary — it exists only to verify the migration, then gets deleted.

### Before migration (Phase 1):
1. Build the current Storyblok-backed site
2. Script crawls every route, captures normalized text content (strip HTML, normalize whitespace)
3. Store snapshots in a temp directory

### After migration (Phase 3):
1. Build the file-based site
2. Same script captures text content from new build
3. **Automated diff loop**: Compare normalized text for every route. Flag mismatches.
4. Claude fixes discrepancies and re-runs until all routes match.
5. Once verified, delete all comparison testing code.

### What gets compared:
- Checklist item titles, descriptions, body content
- Guide section structure and ordering
- All embedded component output (Alert, HowTo, Button text/URLs)
- Link targets, image paths
- News items, changelog entries
- Page content

---

## Implementation Phases

### Phase 1: Foundation (no breaking changes)

Site continues running on Storyblok throughout.

1. Install `next-mdx-remote` v6+, `gray-matter`, `rehype-sanitize`
2. Create `lib/content.js` — content loading functions
3. Create `lib/mdx-components.js` — component map with security overrides
4. Create `lib/mdx-options.js` — shared compilation config with security plugins
5. Create `scripts/validate-content.mjs` — MDX security validator
6. Write migration script (`scripts/migrate-from-storyblok.mjs`)
7. Run migration → generates `content/` directory
8. Run `validate-content.mjs` on generated content (sanity check)
9. Manual review of converted files
10. Capture pre-migration text snapshots for comparison

### Phase 2: Component adaptation

1. Adapt components to accept both Storyblok and file-based props (dual-mode)
2. Create `contexts/ChecklistItemsContext.js`
3. Create guide-aware `<Section>` and `<ChecklistItemRef>` MDX components
4. Adapt embedded components (HowTo, ButtonEmbed, ImageEmbed, VideoEmbed, RiskLevel, RelatedGuides) — remove Storyblok object shape dependencies, accept plain props
5. Switch ChecklistItem localStorage keys to slug-based (accept progress reset)
6. Write tests for both prop modes

### Phase 3: Switch data sources

1. Rewrite `pages/[...slug].js` getStaticProps/getStaticPaths
2. Rewrite `pages/index.js`, `news.js`, `changelog.js`, `checklists.js` getStaticProps
3. Update build scripts (RSS, OG images, build check)
4. **Run automated comparison tests** — diff every route against Phase 1 snapshots
5. Fix discrepancies until normalized text matches across all routes
6. Delete comparison testing code

### Phase 4: Clean up

1. Remove Storyblok packages (`@storyblok/react`, `storyblok-rich-text-react-renderer`)
2. Delete `RichText.js`, `ChecklistItemRef.js`, `ChecklistItemReference.js`
3. Delete Storyblok export scripts (see "Scripts: Remove vs. Preserve" section for full list)
4. Replace `scripts/fetch-news-images.js` with `scripts/fetch-news-images-local.mjs` (reads from MDX files instead of Storyblok API)
5. Remove `storyblokInit` from `_app.js`, bridge code, `storyblokEditable` calls
6. Remove dual-mode prop handling from components
7. Remove Storyblok env vars, update `next.config.js` (remove `a.storyblok.com`)
8. Update `package.json` scripts (remove `storyblockexportimages`, `storyblockexportcontent`, `prestoryblockexport`; update `fetch-news` to use new script)
9. Add CI step for `validate-content.mjs`
10. Add CODEOWNERS for `content/` directory
11. Preserve metadata scrubbing: `metadata-cli.cjs`, `pre-commit-metadata.cjs` (unchanged)
12. Final build verification

### Pre-requisite: Translation / i18n

Translation support must be designed and integrated into the content system BEFORE executing this migration plan. The directory structure and content loading layer depend on the translation strategy.

**Decisions needed:**

- **File structure**: `content/{locale}/checklist-items/{slug}.mdx` (locale-first) vs `content/checklist-items/{slug}.{locale}.mdx` (locale-suffix) vs `content/checklist-items/{locale}/{slug}.mdx` (locale-as-subfolder). Locale-first (`content/{locale}/...`) is most common for translation tools.
- **i18n framework**: `next-intl` (recommended for Pages Router) or `next-i18next` for routing + UI strings. Content files handled separately by the content loading layer.
- **Ref resolution across locales**: Do `<ChecklistItemRef ref="use-signal" />` refs point to the same slug in the current locale? (Yes — the content loader resolves `ref` to the locale-appropriate file with English fallback.)
- **Translation management tool**: Weblate, Crowdin, or Pontoon for managing translations with "out of date" tracking.

**Translation tool research notes** (brief — full decision deferred):

- **Weblate**: Open-source, self-hostable. Supports git-based workflows (watches repo, creates PRs with translations). Can handle Markdown files. Tracks "source string age" — when English source file changes, all translations of that file are marked "fuzzy" (needs update). This is exactly the "out of date notification" feature desired. MDX would likely need to be treated as Markdown format or use a custom Weblate component. Weblate's "file discovery" addon can auto-discover translated files using path patterns like `content/*/checklist-items/*.mdx`.
- **Crowdin**: SaaS (free for open source). Similar git-based workflow. Good Markdown support. Has "outdated strings" tracking. More polished UI than Weblate. Less self-host flexibility.
- **Neither tool natively understands MDX components** — they'd see `<Alert>`, `<HowTo>` etc. as untranslatable markup (which is correct — translators translate the text content, not the component tags). This actually works well with MDX since component names/props are code and the text between them is the translatable content.
- **Key compatibility note for CMS**: TinaCMS has i18n support (locale-based collections). Keystatic has a locales config. Either works with locale-first directory structure. This reinforces choosing `content/{locale}/...` as the file layout.

This must be resolved before Phase 1 begins.

### Phase 5 (future): Visual editing

- Add TinaCMS (or Keystatic if App Router migration happens)
- Define schemas matching frontmatter fields
- Register MDX component templates
- Simpler content types (checklist items, pages, news) get visual editing first
- Guide structure may remain code-edited if CMS can't handle it

---

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| **MDX for everything** (including news, sources) | Consistency across the whole system |
| **Guides use MDX** (not YAML) | YAML gets messy with nested rich text |
| **File-based first**, TinaCMS later | Working system faster; CMS adds complexity |
| **`{class}text{/}` → `<span>`** during migration | No custom parser needed |
| **Accept localStorage progress reset** | Slug-based keys, no legacy migration |
| **Keep nesting shallow** | CMS compatibility; matches actual content patterns |
| **String refs for cross-content** | CMS-agnostic; every tool can edit strings |
| **4-layer MDX security** | Defense in depth for activist security site |
| **Simple file reads, no GraphQL** | 231 items at build time; TinaCMS adds GraphQL later if needed |
| **Comparison testing is temporary** | Exists only for migration verification, then deleted |
| **Translation must be designed first** | Directory structure and content loading depend on i18n strategy |

## Verification

After each phase:
1. `yarn build` completes without errors
2. `yarn test` passes
3. `node scripts/validate-content.mjs` passes (Phases 1+)
4. Visual spot-check of key pages (essentials guide, signal guide, about page, news page)
5. After Phase 3: automated comparison test suite passes for all routes
