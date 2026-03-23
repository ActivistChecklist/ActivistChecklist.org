/**
 * Central MDX component map for rendering file-based MDX content.
 *
 * Maps MDX tag names to React components. During the migration (Phase 2),
 * these components will be adapted to accept plain props instead of Storyblok
 * `blok` objects. For now, this file defines the registry and security overrides.
 *
 * Security: Dangerous HTML elements are overridden to render nothing.
 * Only explicitly listed components can be used in MDX content.
 */

import React from 'react';
import { Alert } from '@/components/ui/alert';
import { HowTo } from '@/components/guides/HowTo';
import { ButtonEmbed } from '@/components/ButtonEmbed';
import { ImageEmbed } from '@/components/ImageEmbed';
import { VideoEmbed } from '@/components/VideoEmbed';
import { RiskLevel } from '@/components/RiskLevel';
import { RichTextTable } from '@/components/RichTextTable';
import RelatedGuides from '@/components/RelatedGuides';
import Link from '@/components/Link';
import CopyButton from '@/components/CopyButton';
import { Badge } from '@/components/ui/badge';
import { ProtectionBadge } from '@/components/guides/ProtectionBadge';
import { InlineChecklist } from '@/components/guides/InlineChecklist';

// ─── Security: block dangerous HTML elements ─────────────────

const Blocked = () => null;

const securityOverrides = {
  script: Blocked,
  iframe: Blocked,
  object: Blocked,
  embed: Blocked,
  form: Blocked,
  input: Blocked,
  textarea: Blocked,
  select: Blocked,
};

// ─── Safe link component ─────────────────────────────────────

function SafeLink({ href, children, ...props }) {
  if (typeof href === 'string' && href.toLowerCase().startsWith('javascript:')) {
    return <span {...props}>{children}</span>;
  }
  return <Link href={href} {...props}>{children}</Link>;
}

// ─── MDX content components ──────────────────────────────────
//
// These are the component names that can appear in MDX content as JSX tags.
// Phase 2 will adapt the underlying components to accept these props directly
// instead of wrapping in a Storyblok `blok` object.
//
// For now, we create thin wrappers that will be replaced when components
// are adapted.

// Section and ChecklistItem are guide-specific components that will be
// created in Phase 2. Placeholder exports here for the component registry.
function Section({ title, slug, children }) {
  return (
    <section id={slug} data-section-slug={slug}>
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}

function ChecklistItem({ ref: refSlug }) {
  // Phase 2: This will use ChecklistItemsContext to resolve the ref
  return <div data-checklist-ref={refSlug} />;
}

// ─── Component map ───────────────────────────────────────────

export const mdxComponents = {
  // Security overrides (block dangerous elements)
  ...securityOverrides,

  // Safe link override
  a: SafeLink,

  // Content components (MDX tag name → React component)
  Alert,
  HowTo,
  Button: ButtonEmbed,
  ImageEmbed,
  VideoEmbed,
  RiskLevel,
  Table: RichTextTable,
  RelatedGuides,
  // RelatedGuide is a child of RelatedGuides wrapper — renders a single guide ref
  RelatedGuide: ({ slug }) => <div data-related-guide={slug} />,
  Section,
  ChecklistItem,
  CopyButton,
  Badge,
  ProtectionBadge,
  InlineChecklist,
};

export default mdxComponents;
