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

## Implementation Sequence

### Phase 1: Storyblok → MDX migration (from migration plan)
No CMS involvement. Just get off Storyblok onto file-based MDX.

### Phase 2: Pages Router → App Router migration
Separate project. Required for Keystatic. Can be done incrementally using Next.js's [incremental adoption strategy](https://nextjs.org/docs/app/building-your-application/upgrading/app-router-migration).

### Phase 3: Add Keystatic

**Code setup:**
1. Install `@keystatic/core` and `@keystatic/next`
2. Create `keystatic.config.js` defining collections and content component schemas
3. Add Keystatic API route (`app/keystatic/[[...params]]/route.js`)
4. Add Keystatic admin page (`app/keystatic/[[...params]]/page.js`)
5. Set up `STATIC_EXPORT` conditional in `next.config.js`
6. Add Draft Mode API routes (`app/api/draft/route.js`, `app/api/exit-draft/route.js`)
7. Update content loading to check `draftMode().isEnabled` and read from branch HEAD when active

**GitHub App setup:**
6. Run project locally, visit `/keystatic`, follow automated setup prompts to create a GitHub App
7. Collect the 4 env vars: `KEYSTATIC_GITHUB_CLIENT_ID`, `KEYSTATIC_GITHUB_CLIENT_SECRET`, `KEYSTATIC_SECRET`, app slug
8. Add the editing deployment's callback URL to the GitHub App settings

**GitHub rulesets:**
9. Go to repo Settings → Rules → Rulesets
10. Create ruleset for `main` branch: require pull request + require 1 approving review
11. Add "Repository admin" as a bypass actor (allows repo owner to self-merge)

**Vercel deployment:**
12. Configure Vercel editing deployment (`edit.activistchecklist.org`) with the 4 Keystatic env vars
13. Configure Vercel production deployment with `STATIC_EXPORT=true` (no Keystatic routes)
14. Test full flow: editor visits `/keystatic` → authenticates → edits → saves → PR created → Vercel preview → repo owner merges → static rebuild

### Phase 4: Configure content component schemas

Define Keystatic schemas for each MDX component:

```typescript
// keystatic.config.ts (simplified)
import { config, collection, fields } from '@keystatic/core'
import { wrapper, block } from '@keystatic/core/content-components'

const checklistItems = collection({
  label: 'Checklist Items',
  slugField: 'title',
  path: 'content/en/checklist-items/*',
  format: { contentField: 'body' },
  schema: {
    title: fields.slug({ name: { label: 'Title' } }),
    type: fields.select({ label: 'Type', options: [...], defaultValue: 'checkbox' }),
    preview: fields.text({ label: 'Preview text' }),
    do: fields.text({ label: 'Do (recommendation)' }),
    dont: fields.text({ label: "Don't (avoid)" }),
    body: fields.mdx({
      label: 'Body',
      components: {
        Alert: wrapper({
          label: 'Alert',
          schema: {
            type: fields.select({ label: 'Type', options: [...] }),
            title: fields.text({ label: 'Title' }),
          },
        }),
        HowTo: wrapper({
          label: 'How To',
          schema: {
            title: fields.text({ label: 'Title' }),
          },
          // HowTo's children can contain Alert and Button
        }),
        Button: block({
          label: 'Button',
          schema: {
            title: fields.text({ label: 'Title' }),
            url: fields.url({ label: 'URL' }),
            variant: fields.select({ label: 'Variant', options: [...] }),
          },
        }),
      },
    }),
  },
})
```

### Phase 5: Translation integration

Add Weblate (or chosen translation tool) watching the repo. Keystatic edits English content; Weblate manages translations independently.

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

## Open Questions

1. **App Router migration scope**: How much work is the Pages Router → App Router migration? This is the main gating factor. Needs its own analysis/plan.

2. **Keystatic wrapper nesting depth — hands-on verification needed**: Keystatic docs show wrapper-inside-wrapper examples (Container → Testimonial) and there's no documented depth limit. Our depth-2 pattern (`HowTo` → `Alert`) should work, but needs hands-on testing to confirm the editor UI handles it well (can editors insert an Alert inside a HowTo in the visual editor?).

3. **Keystatic + `output: 'export'`**: Has anyone successfully used Keystatic's Reader API with Next.js `output: 'export'`? The Reader API is build-time only, so it should work, but needs verification.

4. **Vercel free tier limits**: Is the Vercel Hobby plan sufficient for the editing deployment? (Serverless function limits, build minutes, etc.)

## Resolved Questions

- **~~MDX format compatibility~~**: Confirmed — Keystatic's `fields.mdx()` reads and writes standard JSX tags (`<Component>`) to `.mdx` files. The `{% %}` syntax is only for `fields.markdoc()` which we don't use. **Our migration plan's MDX format works with Keystatic as-is. No changes needed.**
