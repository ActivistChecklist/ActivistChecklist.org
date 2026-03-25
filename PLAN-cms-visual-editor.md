# CMS Visual Editor Analysis for ActivistChecklist.org

## Context

After migrating off Storyblok to file-based MDX content (see `PLAN-storyblok-migration.md`), we need a visual editing solution so non-technical contributors can edit content without writing raw MDX. This document analyzes which CMS can handle our content patterns given these constraints:

### Hard constraints

- **Free** — no paid SaaS, no paid tiers
- **Full control over translation** — no vendor lock-in on i18n (Storyblok locked us into paying for their translation system)
- **Nested content blocks** — must handle `HowTo → Alert`, `HowTo → Button`, `Section → RiskLevel/Alert/ChecklistItem`
- **Fully static production build** — `output: 'export'` or equivalent, no reliance on Next.js API routes at runtime
- **App Router migration is acceptable** if needed

### Strong preferences

- **Real-time preview** preferred (like TinaCMS's `useTina` hook), but **save-and-preview** (like Keystatic's approach with draft mode) is acceptable
- **Block embed support in the editor** for nested components would be ideal but not required
- **Remote editing** — non-technical content editors must be able to edit without cloning the repo or running anything locally
- **Security** — must not expose attack surface on production; CMS admin can be on a separate deployment
- **All content changes must go through a PR** that only the repo owner can approve and merge
- **Repo owner must be able to self-merge** their own PRs without needing someone else's review
- **Free GitHub tier only** — no paid GitHub plans

---

## What We Need a CMS to Handle

### Our MDX component inventory

| Component | Props | Children | Where Used |
|-----------|-------|----------|------------|
| **Section** | title, slug | RiskLevel, Alert, ChecklistItem, markdown | Guide bodies |
| **ChecklistItem** | ref (slug string) | none (self-closing) | Inside Section |
| **RiskLevel** | level (enum) | markdown text (up to ~156 chars) | Inside Section |
| **Alert** | type (enum), title | markdown text (up to ~549 chars) | Inside Section, HowTo, checklist item bodies |
| **HowTo** | title | markdown text + Alert + Button | Checklist item bodies, guide bodies |
| **Button** | title, url, variant, download, icon | none (self-closing) | Inside HowTo, pages, checklist items |
| **ImageEmbed** | src, alt, size, className | caption text | Pages |
| **VideoEmbed** | src, className | caption text | Pages |
| **Table** | className | table data | Checklist items |
| **RelatedGuides** | none | RelatedGuide children | End of guides |
| **RelatedGuide** | slug (string) | none (self-closing) | Inside RelatedGuides |

### Nesting patterns we must support

**Depth 1** (very common — 185 instances):
```
body → Alert | HowTo | Button | RiskLevel | ImageEmbed | VideoEmbed | Table
```

**Depth 2** (12 instances across 12 stories):
```
body → HowTo → Alert        (7 instances)
body → HowTo → Button       (5 instances)
```

**Guide Section pattern** (all 13 guides):
```
Section → RiskLevel (with body text)
Section → Alert (with body text)
Section → ChecklistItem (slug reference)
Section → markdown text
```

### Cross-collection references

- `ChecklistItem ref="use-signal"` — guide references a checklist item by slug
- `<RelatedGuides>` wraps `<RelatedGuide slug="essentials" />` children — guide references other guides by slug (wrapper pattern avoids array props that break Crowdin)
- News item `source: the-intercept` — references a news-source by slug

These are **string slug references resolved at build time**, not live database joins.

---

## TinaCMS: Detailed Assessment

### What works

- **Free and self-hostable** (Apache 2.0 license, no usage limits)
- **Real-time visual editing** via `useTina` hook — page re-renders as you edit in the sidebar
- **Single-level component embedding** works in rich-text templates
- **Frontmatter editing** works great for all content types
- **Top-level cross-collection references** work via `type: "reference"` fields
- **Remote editing** works — editors visit `/admin/` on deployed site, authenticate, and edit

### What breaks

**1. Nested rich-text editing is unstable (multiple open bugs)**

- **[Issue #5496](https://github.com/tinacms/tinacms/issues/5496)** (Feb 2025, OPEN): Rich-text field with block templates containing their own rich-text fields crashes: "Expected template value for field undefined." This is exactly our `HowTo → Alert` pattern.
- **[Issue #5323](https://github.com/tinacms/tinacms/issues/5323)** (Nov 2024, OPEN): Triple-nested templates cause phantom pages and broken editing UIs.
- **[Issue #5979](https://github.com/tinacms/tinacms/issues/5979)** (OPEN): Object fields inside rich-text templates get pathologically nested on save.
- **[Issue #2581](https://github.com/tinacms/tinacms/issues/2581)** (CLOSED WONTFIX): Editing nested rich-text blocks causes the entire MDX file to be wiped on save. Never fixed.

**2. Reference fields inside rich-text templates are not supported**

- **[Issue #3050](https://github.com/tinacms/tinacms/issues/3050)** → **[Discussion #3573](https://github.com/tinacms/tinacms/discussions/3573)** (WONTFIX): Maintainer said "on our roadmap" in Feb 2023. As of April 2025, no implementation.

**3. React 19 not fully supported**

- Our project uses React 19 (Next.js 15). TinaCMS requires **React 18**. Auth packages have compatibility issues. Full React 19 support requires "substantial refactoring" per the Tina team.

**4. No built-in i18n**

- Two manual strategies documented: directory-based (`content/blog/en/`, `content/blog/fr/`) or nested-field-based (`title.en`, `title.fr`). No locale switcher, no side-by-side translation editing, no integration with external translation tools. You'd need to build your own i18n workflow.

**5. Self-hosted limitations**

Without TinaCloud (paid), you lose:
- **Editorial workflow** (branch-based drafts/review/publish) — must manage branches manually via Git
- **Media manager** (repo-based) — must use Cloudinary, S3, or similar
- **Search** — no search endpoints in self-hosted backend
- **Dynamic branch switching** at runtime

Self-hosted backend requires: a database (Vercel KV or MongoDB) + Auth.js for authentication + a serverless API function.

### TinaCMS deployment model

```
Production (static)     → output: 'export', no CMS routes
Editing (Vercel SSR)    → /admin/ route, self-hosted backend API
                          Auth via Auth.js (GitHub OAuth)
                          Database: Vercel KV (free tier)
```

Editors visit the Vercel deployment, authenticate via GitHub, edit content. Changes commit to the repo. Production rebuilds from the static export.

### TinaCMS verdict

| Requirement | Support | Assessment |
|-------------|---------|------------|
| Free | Yes (self-hosted, Apache 2.0) | **Pass** |
| Nested components | Crashes (issues #5496, #2581) | **Fail** |
| Cross-refs in rich-text | Not supported (wontfix) | **Fail** |
| Real-time preview | Yes (`useTina` hook) | **Pass** |
| Remote editing | Yes (deployed `/admin/`) | **Pass** |
| Static production build | Yes (with separate CMS deployment) | **Pass** |
| Translation control | Manual directory-based only | **Weak** |
| React 19 | Not supported | **Fail** |

**TinaCMS cannot handle our core content.** Nested editing crashes. References in rich-text are wontfix. React 19 unsupported. Could work for simple content types (news, changelog) but not guides or checklist items.

---

## Keystatic: Detailed Assessment

### What works

- **Free and open source** (core is fully free, optional Keystatic Cloud free tier for up to 3 users)
- **`fields.mdx()` writes standard JSX tags to `.mdx` files** — the exact same `<Component>` format our migration plan already uses. No format conversion needed. (Keystatic also has `fields.markdoc()` which writes `{% %}` Markdoc syntax to `.mdoc` files — we don't use that.)
- **Best-in-class MDX content component model**: 5 component types:
  - **Wrapper** — contains freeform rich text AND other components. Exactly right for `HowTo` wrapping `Alert` + `Button`, `Section` wrapping `RiskLevel` + `ChecklistItem`
  - **Block** — self-closing components like `Button`, `ChecklistItem`
  - **Inline** — inline components within text
  - **Mark** — text formatting marks
  - **Repeating** — parent/child composition patterns
- **Wrapper nesting IS supported** — docs show Container wrapping Testimonial, TestimonialGrid wrapping multiple Testimonials. No documented depth limit. Our depth-2 pattern (`HowTo` → `Alert`) is within what's demonstrated.
- **Cross-collection references** via `relationship` field (stores slug, shows dropdown selector)
- **No import/export statements** in MDX — matches our security model (Keystatic blocks imports by design)
- **HTML tags not allowed** in Keystatic's MDX field — also matches our security model
- **Git-native** — commits changes directly to repo
- **React 19 + App Router** fully supported

### MDX vs Markdoc: Why our format works as-is

Keystatic has **two completely separate field types** with different on-disk formats:

| | `fields.mdx()` | `fields.markdoc()` |
|---|---|---|
| **File extension** | `.mdx` | `.mdoc` |
| **Tag syntax on disk** | `<Alert type="warning">text</Alert>` | `{% alert type="warning" %}text{% /alert %}` |
| **What we use** | **Yes** | No |

Both field types use the same editor UI and the same content component configuration API (`wrapper()`, `block()`, etc.). The only difference is serialization format. Since we use `fields.mdx()`, Keystatic reads and writes the exact same JSX-style MDX tags our migration plan already produces. **No format changes to the migration plan are needed.**

### Component mapping

```
Section          → wrapper (wraps other components + markdown)
HowTo            → wrapper (wraps markdown + Alert + Button)
Alert            → wrapper (wraps markdown text)
RiskLevel        → wrapper (wraps markdown text)
Button           → block (self-closing, props only)
ChecklistItem → block (self-closing, ref via relationship field)
ImageEmbed       → wrapper (wraps caption text)
VideoEmbed       → wrapper (wraps caption text)
RelatedGuides    → wrapper (wraps RelatedGuide children)
RelatedGuide     → block (self-closing, slug via relationship field)
Table            → block (structured data)
```

This maps perfectly. Wrapper/block distinction is exactly right for our nesting patterns.

### What a Keystatic-managed file looks like on disk

This is what Keystatic would write — it's identical to what our migration script produces:

```mdx
---
title: "Use Signal for encrypted texts and calls"
slug: signal
preview: "Normal calls and texts are not private"
do: "Use Signal"
dont: "Use Facebook Messenger, Telegram, regular texts"
---

Body content in markdown with embedded components...

<Alert type="warning" title="Important">

Alert body goes here. Supports full markdown.

</Alert>

<HowTo title="How to install Signal">

1. Go to signal.org
2. Install the app

<Alert type="info" title="Note">

Signal requires a phone number during setup.

</Alert>

<Button title="Download Signal" url="https://signal.org/download" />

</HowTo>
```

The `<Alert>` inside `<HowTo>` is a wrapper inside a wrapper — Keystatic handles this via its content component nesting support.

### Remote editing model

Keystatic runs in **GitHub Mode** (not Keystatic Cloud) with a self-managed GitHub App for OAuth. This is the right choice — free, fully self-controlled, no paid tiers.

**How editors get access:**
1. Editor creates a GitHub account (Proton email or any email is fine)
2. Repo owner adds them as a collaborator on the public repo (write access — the only permission level available on personal repos)
3. Editor visits `edit.activistchecklist.org/keystatic`, authenticates via GitHub OAuth
4. They can now edit content in the CMS UI

**GitHub App setup:**
- Keystatic has an automated setup flow — run the project locally, visit `/keystatic`, follow the prompts to create a GitHub App
- It generates 4 env vars: `KEYSTATIC_GITHUB_CLIENT_ID`, `KEYSTATIC_GITHUB_CLIENT_SECRET`, `KEYSTATIC_SECRET` (random 64-char string), and app slug
- These get added to the Vercel editing deployment only
- The deployed editing site's callback URL must also be added to the GitHub App settings

### Preview model: Next.js Draft Mode

We'll use **Next.js Draft Mode** on the editing deployment to let editors preview unsaved/in-progress content without waiting for a full Vercel branch build.

**How it works:**
1. Editor makes changes in Keystatic's sidebar UI
2. Keystatic saves the change to a branch
3. Editor clicks "Preview" → hits a `/api/draft` route that enables Draft Mode (sets a cookie)
4. The editing deployment renders the page using the branch content instead of the last static build
5. Editor sees their changes immediately on the editing site — no waiting for a Vercel rebuild

**Implementation:**
- `app/api/draft/route.ts` — enables Draft Mode by calling `draftMode().enable()` and redirecting to the requested page
- `app/api/exit-draft/route.ts` — disables Draft Mode
- In `getStaticProps` (or the App Router equivalent), check `draftMode().isEnabled` — if true, read content from the current branch HEAD instead of the cached static build
- Draft Mode only exists on the editing deployment (`edit.activistchecklist.org`). Production (`output: 'export'`) has no API routes and no Draft Mode.

**Workflow comparison:**

| | Without Draft Mode | With Draft Mode |
|---|---|---|
| Editor saves in Keystatic | Wait for Vercel branch build (~1-2 min) | Click preview link, see changes immediately |
| How preview works | Vercel rebuilds the branch, editor visits preview URL | Draft Mode cookie tells the editing site to read latest branch content |
| Where it runs | Vercel branch preview deployment | Editing deployment (`edit.activistchecklist.org`) |

This is not real-time preview (changes don't appear as you type), but it's much faster than waiting for a full branch rebuild. Save → click preview → see result in seconds.

### Translation / i18n

**No built-in i18n support.** Open feature request ([issue #1080](https://github.com/Thinkmill/keystatic/issues/1080), 23+ upvotes, not implemented).

Workarounds:
- Separate collections per locale (e.g., `posts-en`, `posts-es`)
- Locale prefix in directory structure — matches our planned `content/{locale}/...` layout
- Community members have shared config-based workarounds

**Key point**: Because Keystatic edits files in your repo, you have **full control over translation**. You can use Weblate, Crowdin, or any translation tool alongside Keystatic. Keystatic doesn't lock you into any translation system — it just edits files. Translation tools watch the repo and create PRs with translated content independently.

### Static build compatibility

**Keystatic's Reader API** works at build time — perfect for static builds. The separation:

- **Production build**: `output: 'export'` — uses Reader API at build time, pure static output, no Keystatic admin, no API routes
- **Editing deployment**: standard Next.js build on Vercel — includes `/keystatic` admin route, API routes for GitHub integration

This is exactly the dual-deployment pattern we need.

### Security & access control model

**Authentication:**
- `/keystatic` on a public URL shows only a GitHub login prompt to unauthenticated users
- Only repo collaborators with write access can authenticate
- Admin is completely excluded from production builds (production uses `output: 'export'`)
- Production site has zero server-side attack surface (fully static)

**Branch protection via GitHub Rulesets:**
- Use the newer **rulesets** feature (Settings → Rules → Rulesets), NOT legacy branch protection rules — legacy branch protection doesn't support bypass actor lists on personal repos
- Ruleset on `main` branch: **require a pull request before merging** + **require 1 approving review**
- Add the **"Repository admin" bypass actor role** to the ruleset — since the repo owner is the only admin on this personal account repo, only they can bypass the approval requirement and self-merge their own PRs
- Collaborators (editors) have write access but **cannot push directly to main** or merge without the repo owner's approval due to the ruleset
- Rulesets are **free on public repos** — no paid GitHub plan required

**Result:** All content changes go through PRs. Editors can create branches and PRs via Keystatic, but only the repo owner can approve and merge. The repo owner can approve and merge their own PRs without needing someone else's review.

### Keystatic verdict

| Requirement | Support | Assessment |
|-------------|---------|------------|
| Free | Yes (GitHub Mode is free) | **Pass** |
| Nested components | Excellent (wrapper type) | **Pass** |
| Cross-refs in rich-text | Yes (relationship field) | **Pass** |
| Real-time preview | No (Draft Mode: save → preview in seconds) | **Acceptable** |
| Remote editing | Yes (GitHub Mode on deployed site) | **Pass** |
| Static production build | Yes (Reader API + `output: 'export'`) | **Pass** |
| Translation control | Full control (file-based, no lock-in) | **Pass** |
| React 19 | Supported | **Pass** |
| App Router required | Yes | **Requires migration** |

**Keystatic passes every requirement except it needs App Router.** Since App Router migration is acceptable, this is the clear winner.

---

## Other Options Evaluated (and eliminated)

### CloudCannon
**Eliminated: costs $49+/month.** Violates the "free" constraint. Also not self-hostable and nesting support is unverified.

### Decap CMS / Sveltia CMS
**Eliminated: no MDX support.** Feature request open since 2018, unimplemented. Sveltia CMS has MDX on its roadmap but unclear if shipped.

### Sanity Studio
**Eliminated: database-backed, not git-based.** Uses Portable Text, not MDX. No production-ready bidirectional conversion. Would abandon our file-based architecture.

### Builder.io
**Eliminated: no MDX file editing.** Visual page builder with its own content format. Also has paid tiers.

### Payload CMS
**Eliminated: database-backed, not git-based.** Has interesting MDX ↔ Lexical conversion but requires custom work and App Router. Adding a database is unnecessary complexity for 231 content items.

### Plate.js (custom editor)
**Not eliminated but deferred.** Genuine MDX round-trip editing capability. Would give maximum control but requires weeks-months of development. Could be considered if Keystatic proves insufficient, but Keystatic should be tried first.

---

## Recommended Architecture: Keystatic + App Router

### Deployment topology

```
┌─────────────────────────────────────────────┐
│  Production (activistchecklist.org)          │
│  ─────────────────────────────────────────   │
│  Static build (output: 'export')             │
│  No API routes, no CMS admin, no server      │
│  Deployed to: LAMP static host via FTP       │
│  Rebuilt on: merge to main                   │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  Editing (edit.activistchecklist.org)        │
│  ─────────────────────────────────────────   │
│  Vercel deployment (SSR mode)                │
│  Keystatic admin at /keystatic               │
│  GitHub OAuth for authentication             │
│  Only repo collaborators can access          │
│  Changes commit to branches → PRs            │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  Preview (branch previews on Vercel)         │
│  ─────────────────────────────────────────   │
│  Auto-deployed for each PR/branch            │
│  Editors see their changes rendered           │
│  Same static build, just from branch          │
└─────────────────────────────────────────────┘
```

### How it works for a content editor

**First time setup (one-time):**
1. Editor creates a GitHub account (any email, Proton is fine)
2. Repo owner adds them as a collaborator on the public repo

**Editing workflow:**
1. Editor visits `edit.activistchecklist.org/keystatic`
2. Authenticates with GitHub OAuth (must have repo write access)
3. Edits content in Keystatic's sidebar UI — forms for frontmatter, rich-text for body with embedded components
4. Saves → Keystatic automatically creates a branch and opens a PR
5. Editor clicks "Preview" → Draft Mode renders the page with their changes on the editing site (no rebuild wait)
6. Repo owner reviews the PR, approves, and merges to main (repo owner can self-merge their own PRs via ruleset bypass)
7. Production site rebuilds as a static export

**Key points for non-technical editors:**
- No cloning the repo, no local dev server, no command line
- Everything happens in the browser — Keystatic UI for editing, GitHub for PR review, Vercel for preview
- Editors cannot accidentally break the live site — all changes are PR-gated

### How it works for translation

Keystatic doesn't touch translations. Translation workflow is independent:

1. Content is written in English in `content/en/...`
2. Weblate (or Crowdin) watches the repo
3. When English content changes, Weblate marks translations as "fuzzy" (out of date)
4. Translators update translations in Weblate's UI
5. Weblate creates PRs with updated translation files in `content/{locale}/...`
6. Maintainer reviews and merges

Keystatic and Weblate operate independently on the same repo. No lock-in, full control.

### Next.js config (conditional build)

```javascript
// next.config.js
const isStaticExport = process.env.STATIC_EXPORT === 'true'

module.exports = {
  output: isStaticExport ? 'export' : undefined,
  // ... other config
}
```

- **Production build** (`STATIC_EXPORT=true`): Pure static HTML/CSS/JS. No API routes exist. No admin routes exist. Deployable to any static host.
- **Editing deployment** (`STATIC_EXPORT` unset): Standard Next.js with Keystatic API routes and `/keystatic` admin UI.

### Security analysis

| Layer | Protection |
|-------|-----------|
| **Production site** | Fully static — zero server-side attack surface. No admin UI, no API routes, no CMS code. Just HTML/CSS/JS on a LAMP host. |
| **Editing deployment** | Behind GitHub OAuth — only repo collaborators with write access. Keystatic env vars are server-side only. |
| **Branch protection** | GitHub rulesets on `main`: require PR + 1 approving review. Only repo admin can bypass (self-merge). Editors cannot push to main or merge without approval. Free on public repos. |
| **Content changes** | All changes go through GitHub PRs — reviewable, auditable, revertible. CODEOWNERS requires maintainer approval for `content/` changes. |
| **MDX security** | 4-layer defense in depth (CI validation, compilation-time, rendering-time, human review) catches any malicious content regardless of how it was authored. |
| **Vercel access** | Optional: add password protection via Vercel Pro ($20/mo) or free Passfort for extra layer. GitHub OAuth alone is likely sufficient. |

The CMS admin code being in the repo is fine because:
1. It only runs on the Vercel editing deployment, not production
2. Production builds with `output: 'export'` physically exclude all API routes and server code
3. Even if someone found the Vercel URL, GitHub OAuth blocks unauthenticated access
4. All content changes are PR-gated — editors create branches/PRs but cannot merge without repo owner approval
5. GitHub rulesets ensure only the repo admin can approve and merge to `main`

---

## Key Architecture Decisions

### Decision 1: Keep existing content pipeline for production builds

Keystatic's Reader API provides type-safe content access and schema validation, but **no preview magic**. Previews work through a separate draft mode mechanism. Our existing `lib/content.js` is already well-tailored to our needs (locale fallback, cross-reference resolution, news item handling, etc.).

**Approach**: Keystatic writes standard MDX files → our existing `lib/content.js` pipeline reads them at build time. On the editing deployment, we additionally use Keystatic's `createGitHubReader` for draft mode previews (reading from preview branches). Production builds never touch the Keystatic Reader API.

**Why**: Avoids migrating working, battle-tested code. Keystatic's Reader API would need custom extensions to match our locale fallback logic, cross-reference resolution, and special content type handling. Using Keystatic only as an editing UI keeps the integration surface small.

### Decision 2: Content refactoring before Keystatic integration

Two content patterns need cleanup before they can map cleanly to Keystatic schemas:

**2a. Flatten news items** — Move from `content/en/news/2024/*.mdx` year subdirectories to flat `content/en/news/*.mdx`. Keystatic's nested path support (`**`) requires editors to manually type year prefixes in slugs, which is error-prone. Flat structure is simpler. News date is already in frontmatter, so year subdirs are redundant.

**2b. Move RelatedGuides to frontmatter for pages** — Guides already use `relatedGuides: [slug1, slug2]` in frontmatter. Pages use `<RelatedGuides><RelatedGuide slug="..." /></RelatedGuides>` in the MDX body, which is then regex-extracted in `getStaticProps` (lines 168-176 of `[...slug].js`). Unify by moving pages to the same frontmatter pattern. Eliminates fragile regex extraction and makes it editable via Keystatic's relationship field.

**Guide structure stays in MDX** — Section, ChecklistItem, RiskLevel, and other guide components remain as inline MDX content components. This is exactly what Keystatic's wrapper/block content component model is designed for. Editors compose guide structure visually in the rich-text editor: insert a Section wrapper, drop ChecklistItem blocks inside it (selecting items from a dropdown via relationship field), add RiskLevel indicators, etc. No need to move this to frontmatter — the whole point of Keystatic is editing this kind of structured MDX.

### Decision 3: Dual content pipeline (production vs editing)

```
Production build (static export):
  lib/content.js reads MDX files from disk → next-mdx-remote serializes → static HTML

Editing deployment (Vercel SSR):
  Normal page loads: same as production (lib/content.js reads from disk)
  Draft mode active: createGitHubReader reads from preview branch → renders preview
  /keystatic admin: Keystatic UI for editing → commits to branches → opens PRs
```

---

## Implementation Sequence

### Phase 0: Proof of Concept

**Status**: A throwaway App Router app was maintained in `keystatic-poc/` at the repo root only for tooling experiments. **That directory has been deleted** — it is not required for production, Phase 1, or Phase 2. There is no remaining proof that must happen inside a separate POC folder.

**What was verified (engineering / build)**:

1. **Keystatic + Next.js App Router (yarn)** — `@keystatic/core`, `@keystatic/next`, and **`@markdoc/markdoc`** (per [installation docs](https://keystatic.com/docs/installation-next-js)) install and compile; `keystatic.config.ts`, `makePage` + `makeRouteHandler`, and local storage mode are wired correctly for `yarn dev` / `yarn build`.
2. **Static export vs Route Handlers** — With `output: 'export'`, Next.js **still analyzes `app/api/**/route.ts` files**. The **`showAdminUI` + `notFound()` pattern on `/keystatic` does not remove those handlers from the filesystem**, so the static export build **fails** unless the API routes are not present during that build. Practical options for the **production static export** (LAMP deploy): (a) a small build script that **moves `app/api` entirely outside `app/`** (e.g. project-root `.poc-api-backup`) for the export build only, then restores it; (b) conditional packaging / separate entry; or (c) any approach that guarantees **no Route Handlers under `app/`** when `output: 'export'` runs. **Important**: renaming `app/api` to something **still under `app/`** (e.g. `app/api.__backup`) does **not** work — Next treats arbitrary folders under `app/` as routes and will still fail. The **editing deployment** (Vercel) uses a normal `next build` **without** `output: 'export'`, so Keystatic API routes are fine there.
3. **`/keystatic/[[...params]]` + static export** — The optional catch-all admin route needs **`generateStaticParams()`** (e.g. return `[{ params: [] }]` so `/keystatic` prerenders) or the export build errors; this is in addition to hiding/disabling the admin UI for production UX.
4. **Monorepo / nested app** — If this repo keeps a nested Next app or a second `yarn.lock` under a subfolder, Next 16 may infer the wrong Turbopack workspace root when the parent directory also has a lockfile. Set **`turbopack.root`** to the Next app directory (e.g. `process.cwd()` when builds always run from that folder) to avoid the warning and mis-resolution.

**Scaffolding reference** (for anyone reproducing a minimal app):

- Greenfield: **`yarn create @keystatic@latest`** (or `npm create @keystatic@latest`) is the official CLI; alternatively `create-next-app` in a subfolder then **`yarn add @keystatic/core @keystatic/next @markdoc/markdoc`**.
- POC schema sketch: collections analogous to **`testItems`** / **`testGuides`** with `fields.mdx()` and content components **`HowTo` → `Alert` / `Button`**, **`Section` → `ChecklistItem` (relationship) / `RiskLevel`**.

**Still to validate in the real product (Phase 3 or first editor session)** — not covered by build-only POC:

- [ ] **Editor UX**: Insert `HowTo` → nested `Alert`; confirm save and MDX shape: `<HowTo title="..."><Alert type="...">...</Alert></HowTo>`.
- [ ] **Edge depth**: e.g. `HowTo` → `Alert` → inner `HowTo` (document if the UI allows or blocks it).
- [ ] **Relationship in MDX**: `ChecklistItem` with `fields.relationship()` shows a dropdown and persists `<ChecklistItem slug="..." />` (or equivalent) in the file.
- [ ] **GitHub Mode** with this repo (or a fork): OAuth, branch, PR flow — remains Phase 3 setup.

**If relationship fields fail in content components**: Fall back to `fields.text()` for the slug; same MDX contract, worse UX (see Risk Register).

**If wrapper nesting fails in the editor**: Stop and reassess Keystatic vs Plate.js / custom (see Risk Register).

---

### Phase 1: Content Refactoring (pre-migration prep)

These changes happen **before** App Router or Keystatic. They simplify the content model so it maps cleanly to Keystatic schemas. Each sub-phase is independently deployable and shippable to production.

#### Phase 1a: Flatten news directory structure

**Change**: Move `content/en/news/2024/*.mdx`, `content/en/news/2025/*.mdx`, etc. → `content/en/news/*.mdx`

**Files to modify**:
- Move all MDX files to `content/en/news/` (flat)
- `lib/content.js`: Change `getAllNewsItems` to use `readCollection('news', locale)` (non-recursive). Change `getNewsItem` to use `readMdxFileWithFallback` directly.
- Remove `listMdxFilesRecursive` if no longer used anywhere.

**Edge cases**:
- **Slug collisions**: Two news items in different year dirs could have the same filename. Audit first: `find content/en/news -name "*.mdx" -exec basename {} \; | sort | uniq -d`. If collisions exist, rename the files (prepend date or add suffix).
- **Git history**: `git mv` preserves history. Move files one directory at a time.
- **Spanish translations**: Also flatten `content/es/news/` if it exists.

#### Phase 1b: Move RelatedGuides to page frontmatter

**Change**: Pages currently embed `<RelatedGuides><RelatedGuide slug="..." /></RelatedGuides>` in MDX body. Move to frontmatter `relatedGuides: [slug1, slug2]` (same format guides already use).

**Files to modify**:
- Each page MDX that has `<RelatedGuides>` — extract slugs, add to frontmatter, remove from body
- `pages/[...slug].js`: Remove the regex extraction logic (lines 168-176). Instead, pass `frontmatter.relatedGuides` to the Page component.
- `components/pages/Page.js`: Render RelatedGuides from frontmatter array prop instead of serialized MDX.

**Edge cases**:
- **Pages with no RelatedGuides**: Already handled — `relatedGuides` field is optional.
- **Pages with RelatedGuides in the middle of content** (not at the end): Audit all pages. If any have RelatedGuides mid-content, those need special handling (keep as MDX component for those pages, or restructure content).

---

### Phase 2: App Router Migration (REQUIRED — Keystatic will not work without this)

**Keystatic requires App Router.** It uses App Router API route handlers (`app/api/keystatic/[...params]/route.ts`) and the `app/keystatic/[[...params]]/page.tsx` catch-all route for its admin UI. These cannot be implemented in Pages Router. This is the largest phase and a hard blocker for Phase 3. The actual implementation details belong in a dedicated `PLAN-app-router-migration.md`.

#### What must change

**Routing**:
- `pages/[...slug].js` → `app/[...slug]/page.tsx`
- `pages/index.js` → `app/page.tsx`
- `pages/checklists.js` → `app/checklists/page.tsx`
- `pages/news.js` → `app/news/page.tsx`
- `pages/changelog.js` → `app/changelog/page.tsx`
- `pages/contact.js` → `app/contact/page.tsx`
- `pages/_app.js` → `app/layout.tsx`
- `pages/_document.js` → `app/layout.tsx` (merged)
- `pages/dev/*` → `app/dev/*/page.tsx`

**Data loading**:
- `getStaticProps` → async Server Components (data fetched directly in the component)
- `getStaticPaths` → `generateStaticParams`
- `serialize()` from next-mdx-remote → `compileMDX()` or `MDXRemote` with RSC support (next-mdx-remote v5+ has App Router support via `next-mdx-remote/rsc`)

**i18n** (account for, but separate implementation):
- Next.js built-in `i18n` config in `next.config.js` is **Pages Router only**. App Router doesn't support it.
- Must migrate to middleware-based i18n routing: `middleware.ts` detects locale and redirects to `app/[locale]/...` route segments.
- `next-intl` has an App Router integration that handles this, but it's a different API than the Pages Router version.
- **Important**: This is a significant sub-project. The plan should account for it but it can be implemented as part of the App Router migration or as a follow-up.

**Client/Server component boundaries**:
- All interactive components (checkbox state, accordion expand/collapse, theme toggle, search, localStorage access) must be `'use client'` components.
- Layout, data fetching, and MDX rendering can stay as Server Components.
- Context providers (`ChecklistItemsContext`, `SectionContext`, `TableOfContentsContext`, `LayoutContext`) must be in `'use client'` wrapper components.
- `useRouter` from `next/router` → `useRouter` from `next/navigation` (different API: no `locale`, no `defaultLocale`, etc.)

**Head/Metadata**:
- `<Head>` from `next/head` → `export const metadata` or `generateMetadata()` in page files
- OG image generation via `satori` can use Next.js App Router's built-in `opengraph-image.tsx` convention

**Static export**:
- `BUILD_MODE=static` with `output: 'export'` should still work in App Router
- But `i18n` middleware won't run in static export — need to use route groups `app/(en)/...` and `app/(es)/...` or `app/[locale]/...` with `generateStaticParams` returning all locales
- API rewrites for Fastify dev proxy → need different approach (env-based fetch URLs)

**Things that stay the same**:
- `lib/content.js` — unchanged, still reads files with `fs`
- `lib/mdx-options.js` — remark plugins work the same
- `lib/mdx-components.js` — component map unchanged
- All component files — unchanged (except adding `'use client'` where needed)
- `styles/globals.css`, `tailwind.config.js` — unchanged
- `scripts/*` — unchanged
- Fastify API server — unchanged
- Content files — unchanged

#### Migration strategy

Use Next.js's incremental adoption:
1. Create `app/layout.tsx` alongside `pages/_app.js`
2. Migrate one route at a time (start with simplest: `contact`, then `changelog`, then `news`, then `checklists`, then pages, then guides)
3. Both routers work simultaneously during migration
4. Delete `pages/` directory entries as each route is migrated
5. Run the full test suite + manual testing after each route migration
6. Final step: remove `pages/` directory entirely

---

### Phase 3: Keystatic Integration

**Prerequisite**: Phase 0 build learnings incorporated (this doc); Phase 1 content refactoring done; Phase 2 App Router migration complete; Phase 3 kickoff should include the **editor UX checklist** under Phase 0 (nesting, relationships, GitHub Mode) if not already done on the integrated app.

#### Step 3.1: Install and configure Keystatic

```bash
yarn add @keystatic/core @keystatic/next
```

Create `keystatic.config.tsx`:

```typescript
import { config, collection, fields, singleton } from '@keystatic/core'
import { wrapper, block } from '@keystatic/core/content-components'

// ─── Shared content components (reused across collections) ───────

const alertComponent = wrapper({
  label: 'Alert',
  description: 'Warning, info, or success callout box',
  schema: {
    type: fields.select({
      label: 'Type',
      options: [
        { label: 'Warning', value: 'warning' },
        { label: 'Info', value: 'info' },
        { label: 'Success', value: 'success' },
        { label: 'Error', value: 'error' },
      ],
      defaultValue: 'warning',
    }),
    title: fields.text({ label: 'Title' }),
  },
})

const buttonComponent = block({
  label: 'Button',
  description: 'Call-to-action button',
  schema: {
    title: fields.text({ label: 'Title', validation: { isRequired: true } }),
    url: fields.url({ label: 'URL', validation: { isRequired: true } }),
    variant: fields.select({
      label: 'Variant',
      options: [
        { label: 'Default', value: 'default' },
        { label: 'Outline', value: 'outline' },
        { label: 'Ghost', value: 'ghost' },
      ],
      defaultValue: 'default',
    }),
    icon: fields.text({ label: 'Icon name (optional)' }),
    download: fields.checkbox({ label: 'Download link?' }),
  },
})

const howToComponent = wrapper({
  label: 'How To',
  description: 'Step-by-step instructions (can contain Alerts and Buttons)',
  schema: {
    title: fields.text({ label: 'Title', validation: { isRequired: true } }),
  },
  // Children: freeform markdown + Alert + Button (inherits all registered components)
})

const imageEmbedComponent = wrapper({
  label: 'Image',
  description: 'Image with optional caption',
  schema: {
    src: fields.text({ label: 'Image path', validation: { isRequired: true } }),
    alt: fields.text({ label: 'Alt text', validation: { isRequired: true } }),
    size: fields.select({
      label: 'Size',
      options: [
        { label: 'Small', value: 'small' },
        { label: 'Medium', value: 'medium' },
        { label: 'Large', value: 'large' },
        { label: 'Full', value: 'full' },
      ],
      defaultValue: 'medium',
    }),
  },
})

const videoEmbedComponent = wrapper({
  label: 'Video',
  description: 'Video embed with optional caption',
  schema: {
    src: fields.text({ label: 'Video path', validation: { isRequired: true } }),
  },
})

const copyButtonComponent = block({
  label: 'Copy Button',
  description: 'Text with a copy-to-clipboard button',
  schema: {
    text: fields.text({ label: 'Text to copy' }),
  },
})

// ─── Shared content component set ────────────────────────────────

const contentComponents = {
  Alert: alertComponent,
  HowTo: howToComponent,
  Button: buttonComponent,
  ImageEmbed: imageEmbedComponent,
  VideoEmbed: videoEmbedComponent,
  CopyButton: copyButtonComponent,
}

// ─── Badge components (checklist items only) ─────────────────────

const badgeComponent = block({
  label: 'Badge',
  schema: {
    variant: fields.text({ label: 'Variant' }),
    children: fields.text({ label: 'Text' }),
  },
})

const protectionBadgeComponent = block({
  label: 'Protection Badge',
  schema: {
    type: fields.select({
      label: 'Type',
      options: [
        { label: 'Basic', value: 'basic' },
        { label: 'Enhanced', value: 'enhanced' },
      ],
      defaultValue: 'basic',
    }),
  },
})

// ─── Collections ─────────────────────────────────────────────────

export default config({
  storage: {
    // Local mode for dev, GitHub mode for production editing
    kind: process.env.NODE_ENV === 'development' ? 'local' : 'github',
    repo: {
      owner: 'OWNER',
      name: 'ActivistChecklist.org',
    },
  },

  collections: {
    checklistItems: collection({
      label: 'Checklist Items',
      slugField: 'title',
      path: 'content/en/checklist-items/*',
      format: { contentField: 'body' },
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        type: fields.select({
          label: 'Type',
          options: [
            { label: 'Action (with checkbox)', value: 'action' },
            { label: 'Info (no checkbox)', value: 'info' },
          ],
          defaultValue: 'action',
        }),
        preview: fields.text({ label: 'Preview text', multiline: true }),
        why: fields.text({ label: 'Why this matters', multiline: true }),
        do: fields.text({ label: 'Do (recommendation)' }),
        tools: fields.text({ label: 'Tools (alternative to Do)' }),
        dont: fields.text({ label: "Don't (avoid)" }),
        stop: fields.text({ label: 'Stop (alternative to Dont)' }),
        titleBadges: fields.multiselect({
          label: 'Title Badges',
          options: [{ label: 'Important', value: 'important' }],
        }),
        firstPublished: fields.date({ label: 'First Published' }),
        lastUpdated: fields.date({ label: 'Last Updated' }),
        body: fields.mdx({
          label: 'Body',
          components: {
            ...contentComponents,
            Badge: badgeComponent,
            ProtectionBadge: protectionBadgeComponent,
            InlineChecklist: wrapper({
              label: 'Inline Checklist',
              description: 'Converts bullet list into interactive checklist',
              schema: {
                storageKey: fields.text({ label: 'Storage key (for localStorage)' }),
              },
            }),
          },
        }),
      },
    }),

    guides: collection({
      label: 'Guides',
      slugField: 'title',
      path: 'content/en/guides/*',
      format: { contentField: 'body' },
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        estimatedTime: fields.text({ label: 'Estimated Time' }),
        summary: fields.text({ label: 'Summary', multiline: true }),
        relatedGuides: fields.array(
          fields.relationship({
            label: 'Related Guide',
            collection: 'guides',
          }),
          { label: 'Related Guides', itemLabel: (props) => props.value || 'Select guide...' }
        ),
        firstPublished: fields.date({ label: 'First Published' }),
        lastUpdated: fields.date({ label: 'Last Updated' }),
        // Guide body uses Section/ChecklistItem/RiskLevel as MDX content components.
        // Editors compose guides visually: insert Section wrappers, drop in
        // ChecklistItem blocks (with relationship field for slug), etc.
        body: fields.mdx({
          label: 'Guide Content',
          components: {
            ...contentComponents,
            Section: wrapper({
              label: 'Section',
              description: 'Guide section that groups checklist items',
              schema: {
                title: fields.text({ label: 'Section Title', validation: { isRequired: true } }),
                slug: fields.text({ label: 'Section Slug', validation: { isRequired: true } }),
              },
              // Children: RiskLevel, ChecklistItem blocks, Alerts, prose, etc.
            }),
            ChecklistItem: block({
              label: 'Checklist Item',
              description: 'Reference to a checklist item by slug',
              schema: {
                slug: fields.relationship({
                  label: 'Checklist Item',
                  collection: 'checklistItems',
                }),
              },
            }),
            RiskLevel: wrapper({
              label: 'Risk Level',
              description: 'Who this section applies to',
              schema: {
                level: fields.select({
                  label: 'Level',
                  options: [
                    { label: 'Everyone', value: 'everyone' },
                    { label: 'Medium Risk', value: 'medium' },
                    { label: 'High Risk', value: 'high' },
                  ],
                  defaultValue: 'everyone',
                }),
                mode: fields.select({
                  label: 'Mode',
                  options: [
                    { label: 'Default', value: 'default' },
                    { label: 'For You', value: 'for_you' },
                    { label: 'For You If', value: 'for_you_if' },
                  ],
                  defaultValue: 'default',
                }),
              },
            }),
            RelatedGuides: wrapper({
              label: 'Related Guides',
              description: 'Block showing related guide cards',
              schema: {},
            }),
            RelatedGuide: block({
              label: 'Related Guide',
              description: 'Reference to a related guide',
              schema: {
                slug: fields.relationship({
                  label: 'Guide',
                  collection: 'guides',
                }),
              },
            }),
          },
        }),
      },
    }),

    pages: collection({
      label: 'Pages',
      slugField: 'title',
      path: 'content/en/pages/*',
      format: { contentField: 'body' },
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        relatedGuides: fields.array(
          fields.relationship({
            label: 'Related Guide',
            collection: 'guides',
          }),
          { label: 'Related Guides', itemLabel: (props) => props.value || 'Select guide...' }
        ),
        firstPublished: fields.date({ label: 'First Published' }),
        lastUpdated: fields.date({ label: 'Last Updated' }),
        body: fields.mdx({
          label: 'Body',
          components: contentComponents,
        }),
      },
    }),

    news: collection({
      label: 'News',
      slugField: 'title',
      path: 'content/en/news/*',  // flat after Phase 1a
      format: { contentField: 'body' },
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        date: fields.date({ label: 'Date', validation: { isRequired: true } }),
        url: fields.url({ label: 'Article URL' }),
        source: fields.text({ label: 'Source Publication' }),
        tags: fields.array(fields.text({ label: 'Tag' }), { label: 'Tags' }),
        imageOverride: fields.text({ label: 'Image Override Path' }),
        firstPublished: fields.date({ label: 'First Published' }),
        lastUpdated: fields.date({ label: 'Last Updated' }),
        body: fields.mdx({
          label: 'Comment (optional)',
          components: {},  // news items don't use MDX components
        }),
      },
    }),

    changelog: collection({
      label: 'Changelog',
      slugField: 'slug',
      path: 'content/en/changelog/*',
      format: { contentField: 'body' },
      schema: {
        slug: fields.slug({ name: { label: 'Slug' } }),
        date: fields.date({ label: 'Date', validation: { isRequired: true } }),
        type: fields.select({
          label: 'Type',
          options: [
            { label: 'Minor', value: 'minor' },
            { label: 'Major', value: 'major' },
          ],
          defaultValue: 'minor',
        }),
        firstPublished: fields.date({ label: 'First Published' }),
        lastUpdated: fields.date({ label: 'Last Updated' }),
        body: fields.mdx({
          label: 'Body',
          components: {},
        }),
      },
    }),
  },
})
```

**Edge cases in schema design**:

- **`fields.slug` vs manual slug**: Keystatic's `fields.slug` auto-generates a slug from the title. Our existing slugs are manually curated and don't always match titles. Existing content should retain its slugs — Keystatic respects existing filenames when editing (it only generates slugs for new items).
- **`fields.text` multiline**: Some frontmatter fields (`preview`, `why`) contain multi-line text. Use `multiline: true` for these.
- **`fields.date`**: Keystatic writes dates as `YYYY-MM-DD` strings. Our `gray-matter` parses these as Date objects, then `serializeFrontmatter` converts back to `YYYY-MM-DD`. This round-trip should be clean.
- **`fields.array` for tags**: News tags are currently sometimes stored as comma-separated strings (`tags: "tag1, tag2"`) and sometimes as YAML arrays (`tags: [tag1, tag2]`). Keystatic will write them as YAML arrays. The `toNewsListItem` function in `lib/content.js` handles both formats via `String(fm.tags).split(',')`, but we should normalize all existing news items to YAML arrays during Phase 1a.
- **MDX body with no components**: News and changelog `body` fields use `fields.mdx()` but don't need any content components. Passing empty `components: {}` tells Keystatic not to show the component insertion toolbar for these collections.

#### Step 3.2: Add Keystatic routes

**Admin routes** (editing deployment only):

```typescript
// app/keystatic/layout.tsx
import KeystaticApp from './keystatic-app'

// Only show admin UI when not doing a static export
export const showAdminUI =
  process.env.NODE_ENV === 'development' ||
  process.env.KEYSTATIC_GITHUB_CLIENT_ID !== undefined

export default function KeystaticLayout() {
  if (!showAdminUI) {
    return notFound()
  }
  return <KeystaticApp />
}
```

```typescript
// app/keystatic/[[...params]]/page.tsx
export default function KeystaticPage() {
  return null // rendered by layout
}
```

```typescript
// app/api/keystatic/[...params]/route.ts
import { makeRouteHandler } from '@keystatic/next/route-handler'
import keystaticConfig from '../../../keystatic.config'

export const { POST, GET } = makeRouteHandler({ config: keystaticConfig })
```

**Draft mode routes** (editing deployment only):

```typescript
// app/api/preview/start/route.ts
import { draftMode } from 'next/headers'
import { redirect } from 'next/navigation'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const branch = url.searchParams.get('branch')
  const to = url.searchParams.get('to') || '/'

  if (!branch) {
    return new Response('Missing branch parameter', { status: 400 })
  }

  const draft = await draftMode()
  draft.enable()

  // Store branch name in a cookie for the reader to use
  const response = redirect(to)
  // Note: branch stored via cookie or headers — implementation depends on
  // how we wire up createGitHubReader in the content loading layer
  return response
}
```

```typescript
// app/api/preview/end/route.ts
import { draftMode } from 'next/headers'
import { redirect } from 'next/navigation'

export async function GET() {
  const draft = await draftMode()
  draft.disable()
  return redirect('/')
}
```

**next.config.js changes**:

```javascript
// next.config.js (updated for conditional Keystatic)
const baseConfig = {
  trailingSlash: true,
  images: { unoptimized: true },
  // ... existing webpack config
}

if (process.env.BUILD_MODE === 'static') {
  baseConfig.output = 'export'
  baseConfig.distDir = 'out'
  // ... existing static export config
}

module.exports = baseConfig
```

**Edge cases**:
- **Static export + Keystatic API routes**: `output: 'export'` is incompatible with **any** `app/api/**/route.ts` during that build. `showAdminUI` + `notFound()` on `/keystatic` only affects the admin **page**; it does **not** stop Next from bundling Route Handlers. Production static builds must omit those handlers from under `app/` for the export run (see Phase 0: move `app/api` out of `app/` for the static build, or equivalent). The editing deployment does not use static export, so Keystatic API routes are unproblematic there.
- **Static export + `/keystatic/[[...params]]`**: Define **`generateStaticParams()`** on that segment (e.g. `[{ params: [] }]`) so export can prerender `/keystatic`; combine with `showAdminUI` / env so the shipped static site does not expose a usable admin (404 or empty shell is acceptable).
- **Keystatic env vars on production**: Production builds (static export) must NOT have `KEYSTATIC_GITHUB_CLIENT_ID` set, or the `showAdminUI` flag would be true. Ensure Vercel env vars are scoped: Keystatic vars only on the editing deployment, `BUILD_MODE=static` only on production.

#### Step 3.3: Configure draft-mode-aware content loading

For the editing deployment to support preview, we need a content reader that can fetch from a GitHub branch:

```typescript
// lib/content-preview.ts (new file, editing deployment only)
import { createGitHubReader } from '@keystatic/core/reader/github'
import keystaticConfig from '../keystatic.config'

export function createPreviewReader(branch: string) {
  return createGitHubReader(keystaticConfig, {
    repo: { owner: 'OWNER', name: 'ActivistChecklist.org' },
    ref: branch,
    token: process.env.GITHUB_TOKEN, // read-only token for preview
  })
}
```

In page components (App Router), check draft mode:

```typescript
// Example: app/[...slug]/page.tsx (simplified)
import { draftMode, cookies } from 'next/headers'

export default async function SlugPage({ params }) {
  const draft = await draftMode()

  if (draft.isEnabled) {
    const branch = cookies().get('keystatic-branch')?.value
    if (branch) {
      // Use Keystatic GitHub reader to fetch from preview branch
      const reader = createPreviewReader(branch)
      // ... render from branch content
    }
  }

  // Normal: use lib/content.js to read from disk
  const guide = getGuide(slug, locale)
  // ...
}
```

**Edge cases**:
- **Draft mode on static export**: Draft mode requires a server to set cookies. It will NOT work on the static production site. This is fine — previews only happen on the editing deployment.
- **GitHub token for preview**: The `createGitHubReader` needs a GitHub token to read branch content. This can be the GitHub App's installation token (which Keystatic's auth flow provides) or a separate fine-grained PAT with read-only repo access. The token goes in the editing deployment's env vars only.
- **Preview of new (not yet committed) content**: Keystatic's preview flow requires saving to a branch first. Unsaved editor changes are not previewable — they only exist in the browser's localStorage.
- **Stale preview**: If an editor saves, previews, then saves again, the preview shows the latest save. But if they navigate away and come back, draft mode may still be enabled showing old branch content. The "Exit preview" button calls `/api/preview/end` to clear the cookie.

#### Step 3.4: GitHub App setup

1. Run the project locally in dev mode
2. Visit `http://localhost:3000/keystatic`
3. Follow Keystatic's automated GitHub App creation flow:
   - It prompts you to create a GitHub App on github.com
   - Sets the correct permissions (contents: read/write)
   - Generates the callback URL
4. Collect the 4 env vars:
   - `KEYSTATIC_GITHUB_CLIENT_ID`
   - `KEYSTATIC_GITHUB_CLIENT_SECRET`
   - `KEYSTATIC_SECRET` (random 64-char string for session encryption)
   - GitHub App slug (used in the config)
5. Add the editing deployment's callback URL to the GitHub App settings:
   - `https://edit.activistchecklist.org/api/keystatic/github/oauth/callback`

**Why GitHub App (not OAuth App)**:
- Fine-grained permissions: only `contents: read/write` on specific repos (OAuth App's `repo` scope gives full access to ALL repos)
- Repository-scoped installation: repo owner controls which repos the App can access
- Short-lived tokens (1 hour expiry vs permanent OAuth tokens)
- Independent identity for commits/API calls

**Edge cases**:
- **GitHub App rate limits**: GitHub Apps get 5,000 requests/hour per installation. With 2-5 editors, this is more than enough.
- **GitHub App permissions change**: If we later need to read issues or PRs, the App permissions must be updated and re-approved by the repo owner.
- **Personal repo limitations**: GitHub Apps on personal repos (not orgs) have some restrictions. Keystatic's setup flow handles this — it creates the App on the user's account, not an org.

#### Step 3.5: GitHub rulesets for branch protection

1. Go to repo Settings → Rules → Rulesets (NOT the legacy "Branch protection rules")
2. Create a new ruleset:
   - **Name**: "Protect main"
   - **Enforcement**: Active
   - **Target**: Include `main` branch
   - **Rules**:
     - Require a pull request before merging
     - Require 1 approving review
   - **Bypass actors**: Add "Repository admin" role
3. Verify:
   - Collaborators cannot push directly to `main`
   - Collaborators cannot merge PRs without owner approval
   - Repo owner CAN self-merge their own PRs (bypass actor)

**Why rulesets (not legacy branch protection)**:
- Legacy branch protection on personal repos doesn't support bypass actor lists
- Rulesets are the newer feature and are free on public repos
- Rulesets support the "Repository admin" bypass role, which is how the repo owner can self-merge

**Edge cases**:
- **Keystatic branch creation**: Keystatic creates branches named like `keystatic-{timestamp}` or based on editor input. These are not protected by the ruleset (it only protects `main`).
- **Force push protection**: Consider also adding "Block force pushes" to the ruleset for extra safety.
- **Collaborator removal**: If an editor leaves, remove them as a collaborator. Their existing branches/PRs remain but they can no longer create new ones.

#### Step 3.6: Vercel deployment configuration

**Editing deployment** (`edit.activistchecklist.org`):
- Domain: `edit.activistchecklist.org` (or any subdomain)
- Build command: `yarn build` (standard, NOT static export)
- Env vars:
  - `KEYSTATIC_GITHUB_CLIENT_ID` = (from GitHub App setup)
  - `KEYSTATIC_GITHUB_CLIENT_SECRET` = (from GitHub App setup)
  - `KEYSTATIC_SECRET` = (random 64-char string)
  - `GITHUB_TOKEN` = (fine-grained PAT for preview reader, read-only)
  - Do NOT set `BUILD_MODE=static`
- Branch: `main` (auto-deploys on push to main)

**Production deployment** (activistchecklist.org):
- Remains on the LAMP static host (not Vercel)
- Built via `BUILD_MODE=static yarn build`
- No Keystatic env vars
- Deployed via existing FTP/rsync process

**Vercel branch previews**:
- Already configured for PR previews
- Editors can see their content changes rendered on Vercel preview deployments
- These are full static builds of the branch, not draft mode previews

**Edge cases**:
- **Vercel Hobby plan limits**: 6,000 build minutes/month, 100 GB bandwidth, 12 serverless functions per deployment. With 2-5 editors making occasional edits, this is well within limits. Monitor usage.
- **Vercel serverless function cold starts**: The Keystatic admin API route is a serverless function. First load after inactivity may take 1-2 seconds. Not a problem for an editing tool.
- **CORS**: The editing deployment needs to make API calls to GitHub. Keystatic handles this server-side (route handlers), so no CORS issues.
- **DNS**: `edit.activistchecklist.org` needs a CNAME record pointing to Vercel. The main domain stays on the LAMP host.

---

### Phase 4: Testing and Validation

#### Step 4.1: Content round-trip testing

After Keystatic is integrated, verify that content edited in Keystatic produces identical output to hand-edited MDX:

1. **Edit a checklist item** in Keystatic → save → verify the MDX file matches expected format
2. **Edit a guide** (add/remove/reorder checklist items in a section) → verify MDX structure (Section wrappers, ChecklistItem blocks with correct slugs)
3. **Create a new news item** → verify it appears in the news listing
4. **Test nested components**: Create a checklist item with `HowTo` containing an `Alert` and a `Button` → verify MDX output
5. **Test relationship fields**: Add a checklist item reference to a guide section → verify it saves the correct slug

#### Step 4.2: Security validation

1. **Content validation still works**: Run `scripts/validate-content.mjs` on Keystatic-generated MDX. It should pass (Keystatic doesn't generate imports, exports, or blocked HTML).
2. **MDX security pipeline**: Keystatic's MDX field blocks HTML tags and imports by design. Verify that even if an editor pastes raw HTML into the rich-text editor, Keystatic sanitizes it before saving.
3. **Production site has no admin routes**: Build with `BUILD_MODE=static` and verify no `/keystatic` or `/api/keystatic` routes exist in the output.
4. **Editing site requires authentication**: Visit `edit.activistchecklist.org/keystatic` without being logged in — should see only a GitHub login prompt.

#### Step 4.3: Editor workflow testing

Full end-to-end test with a test collaborator account:

1. Add test account as repo collaborator
2. Test account visits `edit.activistchecklist.org/keystatic`
3. Authenticates via GitHub OAuth
4. Edits a checklist item (change text, add an Alert)
5. Saves → Keystatic creates a branch and PR
6. Verify PR appears on GitHub with correct changes
7. Repo owner reviews and merges PR
8. Verify production site rebuilds with the change
9. Verify test account CANNOT push to main or merge PRs without owner approval

---

### Phase 5: Translation Integration

**Separate from Keystatic**. Keystatic edits English content only. Translation workflow is independent:

1. English content lives in `content/en/`
2. Translation tool (Weblate/Crowdin) watches the repo
3. When English content changes on `main`, translation tool marks translations as outdated
4. Translators update translations in the tool's UI
5. Tool creates PRs with updated files in `content/{locale}/`
6. Repo owner reviews and merges

**Why this works**: Keystatic and the translation tool operate on different directory subtrees. Keystatic edits `content/en/*`. The translation tool edits `content/es/*` (and future locales). No conflicts.

**Edge case**: If an editor uses Keystatic to edit a file that has translations, the translation tool should detect the English source changed and flag the translations as outdated. This depends on the translation tool's change detection (usually based on git diff).

---

## Comparison: TinaCMS vs Keystatic (Final)

| | TinaCMS | Keystatic |
|---|---|---|
| **Cost** | Free (self-hosted) | Free (GitHub Mode) |
| **Nested components** | Crashes / data loss | Works (wrapper type) |
| **Cross-refs in rich-text** | Not supported (wontfix) | Works (relationship field) |
| **Preview** | Real-time (`useTina`) | Draft Mode (save → preview in seconds) |
| **Remote editing** | Deployed `/admin/` | Deployed `/keystatic` |
| **Static build** | Yes (separate backend) | Yes (`output: 'export'`) |
| **Translation** | Manual directory-based | File-based (full control) |
| **React 19** | No | Yes |
| **Auth** | Auth.js + database | GitHub OAuth (no database) |
| **Infrastructure** | Needs database (Vercel KV/MongoDB) | No database needed |
| **App Router** | Not required | Required |

### Why Keystatic wins

1. **It handles our nested MDX components correctly** — the single most important requirement
2. **No database needed** — simpler infrastructure (Vercel KV/MongoDB not required)
3. **React 19 supported** — no downgrade needed
4. **Translation is fully decoupled** — no risk of vendor lock-in
5. **Security model is simpler** — GitHub OAuth only, no separate auth system
6. **The only cost is the App Router migration** — which is a good idea anyway for the long-term health of the project

### What we give up vs TinaCMS

- **Real-time preview** — Keystatic doesn't re-render as you type. With Draft Mode, editors save then click preview to see the result in seconds. Not as slick, but fast enough.
- **Inline visual editing** — TinaCMS can show edits directly on the page. Keystatic uses a sidebar form. A UX downgrade but functional.

These tradeoffs are acceptable because TinaCMS's real-time preview **doesn't work for our content anyway** (it crashes on nested components).

---

## Risk Register

### High risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| Keystatic wrapper nesting doesn't work | Blocks entire plan | Verify in Phase 3 Keystatic UI (Phase 0 checklist); if broken, reassess Keystatic |
| Relationship fields don't work inside content component schemas | Degraded UX (manual slug typing) | Verify in Phase 3; fallback to `fields.text()` is viable |
| App Router migration breaks existing functionality | Site downtime | Incremental migration, full test coverage, feature branch |

### Medium risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| Keystatic + static export has issues | Need alternative admin hosting | Omit `app/api` Route Handlers during static export build (Phase 0); editing site stays non-export |
| next-intl App Router migration is painful | Delays project | Can be deferred — Keystatic doesn't depend on i18n working |
| GitHub App setup is confusing | Delays editor onboarding | Follow Keystatic's automated flow, document steps |
| Vercel Hobby plan limits exceeded | Editing site goes down temporarily | Monitor usage, upgrade if needed ($20/mo) |

### Low risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| Content validation rejects Keystatic-generated MDX | Editor saves fail CI | Keystatic's MDX output is clean by design; validate in Phase 4 |
| Keystatic relationship field doesn't work in content components | Must use text field for slugs | Acceptable fallback — editors type slugs manually |
| Editor accidentally creates duplicate content | Confusion | Keystatic shows existing items; slug uniqueness enforced by filesystem |

---

## Open Questions

1. ~~**App Router migration scope**~~: Accounted for in Phase 2. Detailed implementation plan in separate `PLAN-app-router-migration.md`.

2. **Keystatic wrapper nesting depth**: Docs show it works; **hands-on testing** is listed under Phase 0 (Phase 3 acceptance) — not proven by the deleted build-only POC.

3. ~~**Keystatic + `output: 'export'`**~~: Confirmed: admin UI can be disabled via env, but **Route Handlers must be absent from `app/api` during the static export build** — not solved by `notFound()` alone. Use a build-step move/rename **outside `app/`**, or equivalent (Phase 0 notes).

4. **Vercel free tier limits**: Should be fine for 2-5 editors. Monitor after launch.

5. **News tag normalization**: During Phase 1a, need to audit and normalize all news item tags from comma-separated strings to YAML arrays.

## Resolved Questions

- **~~MDX format compatibility~~**: Confirmed — Keystatic's `fields.mdx()` reads and writes standard JSX tags (`<Component>`) to `.mdx` files. The `{% %}` syntax is only for `fields.markdoc()` which we don't use. **Our migration plan's MDX format works with Keystatic as-is. No changes needed.**

- **~~Content pipeline approach~~**: Keep existing `lib/content.js` for production builds. Use Keystatic Reader API only for draft mode previews on the editing deployment. Keystatic is an editing UI only — it writes files, our pipeline reads them.

- **~~News directory structure~~**: Flatten to `content/en/news/*.mdx`. Year subdirs are redundant (date is in frontmatter).

- **~~RelatedGuides in pages~~**: Move to frontmatter `relatedGuides: [slug1, slug2]` to match guides. Eliminates fragile regex extraction.

- **~~GitHub App vs OAuth App~~**: GitHub App is required by Keystatic for fine-grained permissions, repo-scoped access, and short-lived tokens. OAuth Apps grant too-broad access.

- **~~Keystatic + static export~~**: Known issue with documented workaround. Admin routes return `notFound()` when `showAdminUI` flag is false. Static export skips them.
