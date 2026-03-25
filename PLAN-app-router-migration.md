# App Router Migration Plan

## Status

- [x] Phase 0: POC (Keystatic nesting + relationship fields verified in separate folder, now deleted)
- [x] Phase 1a: Flatten news directory structure
- [x] Phase 1b: Move RelatedGuides to page frontmatter
- [x] Phase 2: App Router Migration (this document)
- [x] Phase 3: Keystatic Integration (keystatic.config.tsx + admin routes added)

---

## Why App Router is Required

Keystatic uses:
- `app/api/keystatic/[...params]/route.ts` — Route Handler (App Router only)
- `app/keystatic/[[...params]]/page.tsx` — Admin UI catch-all (App Router only)

There is no Pages Router equivalent for these patterns.

---

## URL Structure Decision

**We preserve existing URLs exactly.** English content stays at `/`, `/checklists/`, `/security-essentials/`, etc. Spanish stays at `/es/`, `/es/checklists/`, etc.

This is achieved using **Next.js route groups**:
- `app/(en)/` — Route group (no URL segment) for English
- `app/es/` — Actual URL segment for Spanish

Route groups organise files without adding URL segments. Pages inside `app/(en)/` map to `/`, `/checklists/`, etc. Pages inside `app/es/` map to `/es/`, `/es/checklists/`, etc.

**Why not `[locale]` segments?** That would move English to `/en/...`, breaking all existing links and SEO. The route groups approach preserves URLs at the cost of some page-file duplication (which is minimal since all logic is in shared components).

---

## Directory Structure

```
app/
  layout.tsx                       ← Root layout (passes through children)
  not-found.tsx                    ← Catch-all 404 for App Router routes
  (en)/
    layout.tsx                     ← English locale layout (html, body, providers)
    page.tsx                       ← /
    checklists/page.tsx            ← /checklists/
    news/page.tsx                  ← /news/
    changelog/page.tsx             ← /changelog/
    contact/page.tsx               ← /contact/
    [...slug]/page.tsx             ← /[guide-or-page-slug]/
  es/
    layout.tsx                     ← Spanish locale layout
    page.tsx                       ← /es/
    checklists/page.tsx            ← /es/checklists/
    news/page.tsx                  ← /es/news/
    changelog/page.tsx             ← /es/changelog/
    contact/page.tsx               ← /es/contact/
    [...slug]/page.tsx             ← /es/[guide-or-page-slug]/
  api/
    og-image/
      route.ts                     ← Dev OG image preview (replaces pages/api/og-image.js)
    keystatic/
      [...params]/
        route.ts                   ← Keystatic API handler
  keystatic/
    layout.tsx                     ← Admin UI guard (checks env vars)
    [[...params]]/
      page.tsx                     ← Keystatic admin UI
```

---

## Key Technical Decisions

### 1. MDX: Keep `serialize()` + `<MDXRemote>` (client-side)

Do NOT switch to `next-mdx-remote/rsc` (Server Components MDX rendering). Reason:
- Our MDX components (`ChecklistItem`, `HowTo`, `Section`, etc.) have client-side interactivity
- `Guide.js` wraps MDX in `ChecklistItemsContext.Provider` (client-side context)
- The `serialize()` → `<MDXRemote>` pattern still works in App Router
  - Server Component page calls `serialize()`
  - Passes the result as a prop to Client Component `Guide` or `Page`
  - `Guide`/`Page` renders `<MDXRemote {...serializedBody} components={...} />`
- No change to `lib/mdx-options.js` or the component map

### 2. i18n: Remove `next.config.js` i18n block

The Pages Router `i18n` config (`locales`, `defaultLocale`) is incompatible with App Router and must be removed. In App Router, i18n is handled structurally:
- `(en)/layout.tsx` hardcodes `locale="en"` in `NextIntlClientProvider`
- `es/layout.tsx` hardcodes `locale="es"` in `NextIntlClientProvider`
- Page Server Components hardcode the locale constant

### 3. `useRouter` replacement

Components using `next/router`'s `useRouter` need changes:
- `router.locale` → receive `locale` as a prop (passed from Server Component parent)
- `router.locales` → `Object.keys(LOCALES)` (static)
- `router.defaultLocale` → `DEFAULT_LOCALE` (constant)
- `router.push()` / `router.pathname` → `useRouter()` from `next/navigation`

Affected components: `Guide.js`, `Page.js`, homepage component, and any component reading `router.locale` for dates.

### 4. `'use client'` additions

These components use hooks and need the directive:
- `components/guides/Guide.js` — uses `useEffect`, `useTranslations`, context
- `components/pages/Page.js` — uses `useEffect`, `useTranslations`, context
- `components/layout/Layout.js` — renders context providers (already implicitly client)
- All context files in `contexts/` — already use `createContext`/`useState`

### 5. Metadata / Head tags

- `<Head>` from `next/head` → `export const metadata` or `generateMetadata()` in App Router
- OG tags, canonical, hreflang → moved to `generateMetadata` in each page
- Dynamic OG image generation (satori) → stays as build-time generation, no change

### 6. Static export compatibility

- `output: 'export'` stays in `next.config.js` for production builds
- All dynamic routes need `generateStaticParams()`
- Keystatic admin routes return empty `generateStaticParams()` → excluded from static output
- API routes (`route.ts`) are excluded from static export automatically

---

## Migration Steps (Completed Checklist)

### Step 1: Planning and config
- [x] Write this plan document
- [ ] Remove `i18n` block from `next.config.js`
- [ ] Remove Pages Router compatibility shims from `next.config.js`

### Step 2: App directory scaffolding
- [ ] `app/layout.tsx` — root passthrough
- [ ] `app/(en)/layout.tsx` — English layout with providers
- [ ] `app/es/layout.tsx` — Spanish layout with providers
- [ ] `app/not-found.tsx`

### Step 3: Simple pages (no complex data loading)
- [ ] `app/(en)/contact/page.tsx` + `app/es/contact/page.tsx`
- [ ] `app/(en)/changelog/page.tsx` + `app/es/changelog/page.tsx`
- [ ] `app/(en)/news/page.tsx` + `app/es/news/page.tsx`
- [ ] `app/(en)/checklists/page.tsx` + `app/es/checklists/page.tsx`

### Step 4: Homepage
- [ ] `app/(en)/page.tsx` + `app/es/page.tsx`

### Step 5: Complex catch-all route
- [ ] `app/(en)/[...slug]/page.tsx` + `app/es/[...slug]/page.tsx`
- [ ] Update `Guide.js` — add `'use client'`, `locale` prop, fix router usage
- [ ] Update `Page.js` — same

### Step 6: API routes
- [ ] `app/api/og-image/route.ts`

### Step 7: Keystatic (Phase 3)
- [ ] `keystatic.config.tsx`
- [ ] `app/api/keystatic/[...params]/route.ts`
- [ ] `app/keystatic/layout.tsx`
- [ ] `app/keystatic/[[...params]]/page.tsx`

### Step 8: Cleanup
- [ ] Remove all `pages/*.js` files
- [ ] Remove `pages/api/` directory
- [ ] Remove `pages/dev/` directory
- [ ] Verify `yarn build` succeeds
- [ ] Verify `yarn buildstatic` (static export) succeeds

---

## Edge Cases and Gotchas

### Static export + Keystatic routes
Keystatic admin routes (`/keystatic/...`) should NOT appear in the static export. Solution:
- `app/keystatic/[[...params]]/page.tsx` has `generateStaticParams() { return [] }`
- When `KEYSTATIC_GITHUB_CLIENT_ID` is not set, renders `notFound()` — excluded from static output

### `serialize()` in Server Components
`next-mdx-remote/serialize` uses Node.js APIs. It works in App Router Server Components with the default Node.js runtime. It does NOT work in Edge runtime. We use default runtime (Node.js), so no issue.

### Context providers (ChecklistItemsContext, SectionContext)
These are Client Components (use `createContext`/`useState`). They can be rendered from Server Components by passing them as children. The boundary is: Server Component page → renders Client Component Layout → renders Client Component Guide → renders MDX components (also client).

### `useRouter` in `Layout.js`
`Layout.js` doesn't directly use `useRouter` (confirmed by reading the file). It uses its own context hooks. No `useRouter` removal needed in Layout.

### Playground page
`pages/playground.js` is a dev-only search testing page. It should be migrated to `app/(en)/playground/page.tsx` or simply omitted if no longer needed. Skip for now — it's not linked from anywhere in production.

### 404 page
`pages/404.js` → `app/not-found.tsx`. The 404 page uses `useState`/`useEffect` for random variation selection, so it needs `'use client'`.

### Dev OG preview page
`pages/dev/og-preview.js` → `app/(en)/dev/og-preview/page.tsx` if needed. Can be deferred.

### `pages/api/og-image.js`
This is a development-only route for previewing OG images. Replaces with `app/api/og-image/route.ts`.

### Hreflang tags
Currently generated per-page using `router.locales`. In App Router, generated in `generateMetadata()` using `Object.keys(LOCALES)` (static). All pages get the same hreflang set: `en` → `/slug/`, `es` → `/es/slug/`, `x-default` → `/slug/`.

### Spanish static paths
`getAllGuides('es')` uses locale fallback — returns all guide slugs even when Spanish translation doesn't exist (uses English content with `isFallback: true`). So `generateStaticParams()` for `app/es/[...slug]/page.tsx` returns all guide/page slugs for both locales. This is correct.

### ThemeProvider
`next-themes`'s `ThemeProvider` already handles `'use client'` internally. Can be used in Server Component layout files — Next.js will treat it as a Client Component boundary.

### `Script` component in Layout
`Layout.js` uses `Script` from `next/script` for Pagefind. This works in App Router Client Components.
