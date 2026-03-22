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

17 component types total. Embedded-in-richtext: alert, button, how_to, image_embed, video_embed, risk_level, table. Max nesting depth: 4.

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
- Storyblok export scripts (`export-library.js`, `export-stroyblok.mjs`, `export-yaml.js`, etc.)

### Dependencies

- **Remove**: `@storyblok/react`, `storyblok-rich-text-react-renderer`, `storyblok-js-client`, `storyblok-backup`
- **Add**: `next-mdx-remote` (v6+), `gray-matter`, `rehype-sanitize`, `remark-mdx-remove-esm`
- **Keep**: `js-yaml` (move to prod deps), `remark-gfm`

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

### Pre-requisite: Translation / i18n

Translation support must be designed and integrated into the content system BEFORE executing this migration plan. Decisions needed:

- How will translated content be stored? (e.g., `content/checklist-items/{slug}.{locale}.mdx`, or `content/{locale}/checklist-items/{slug}.mdx`, or frontmatter-based)
- Which i18n framework? (next-intl, next-i18next, etc.)
- How does translation interact with the MDX component system, the content loading layer (`lib/content.js`), and the querying functions?
- How does translation affect the guide `<ChecklistItemRef>` resolution (do refs point to locale-specific files or is there a fallback chain)?
- TinaCMS and Keystatic both have i18n support that should inform the file structure decision

This must be resolved before Phase 1 begins, as the directory structure and content loading layer depend on the translation strategy.

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
3. Delete Storyblok export scripts
4. Remove `storyblokInit` from `_app.js`, bridge code, `storyblokEditable` calls
5. Remove dual-mode prop handling from components
6. Remove Storyblok env vars, update `next.config.js` (remove `a.storyblok.com`)
7. Update `package.json` scripts (remove storyblok export commands)
8. Add CI step for `validate-content.mjs`
9. Add CODEOWNERS for `content/` directory
10. Final build verification

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
