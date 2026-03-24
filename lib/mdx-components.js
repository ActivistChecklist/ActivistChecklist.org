/**
 * Central MDX component map for rendering file-based MDX content.
 *
 * Maps MDX tag names to React components. Components accept plain MDX props
 * (not Storyblok `blok` objects) — each component is dual-mode.
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
import ChecklistItemComponent from '@/components/guides/ChecklistItem';
import SectionComponent from '@/components/guides/Section';
import { useChecklistItems } from '@/contexts/ChecklistItemsContext';
import { useSectionContext } from '@/contexts/SectionContext';

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

// ─── Alert: map type → variant for MDX mode ──────────────────
// MDX content uses <Alert type="warning"> but shadcn uses variant prop.

function AlertMdx({ type, variant, children, ...props }) {
  return <Alert variant={type ?? variant} {...props}>{children}</Alert>;
}

// ─── ChecklistItem MDX wrapper ───────────────────────────────
// Resolves slug → item data from ChecklistItemsContext,
// reads expandTrigger from SectionContext, then renders the real component.

// Components available inside checklist item body MDX.
// Intentionally excludes Section and ChecklistItem to prevent nesting.
const bodyComponents = {
  ...securityOverrides,
  a: SafeLink,
  Alert: AlertMdx,
  HowTo,
  Button: ButtonEmbed,
  ImageEmbed,
  VideoEmbed,
  RiskLevel,
  Table: RichTextTable,
  RelatedGuides,
  CopyButton,
  Badge,
  ProtectionBadge,
  InlineChecklist,
};

function ChecklistItemMdx({ slug, ...overrides }) {
  const items = useChecklistItems();
  const { expandTrigger } = useSectionContext();
  const item = items[slug];

  if (!item) {
    console.warn(`ChecklistItem: no item found for slug "${slug}"`);
    return null;
  }

  const { frontmatter, serializedBody } = item;

  return (
    <ChecklistItemComponent
      slug={slug}
      title={frontmatter.title}
      type={frontmatter.type}
      why={frontmatter.preview ?? frontmatter.why}
      tools={frontmatter.do ?? frontmatter.tools}
      stop={frontmatter.dont ?? frontmatter.stop}
      titleBadges={frontmatter.titleBadges ?? frontmatter.title_badges ?? []}
      serializedBody={serializedBody}
      bodyComponents={bodyComponents}
      expandTrigger={expandTrigger}
      {...overrides}
    />
  );
}

// ─── Component map ───────────────────────────────────────────

export const mdxComponents = {
  // Security overrides (block dangerous elements)
  ...securityOverrides,

  // Safe link override
  a: SafeLink,

  // Content components (MDX tag name → React component)
  Alert: AlertMdx,
  HowTo,
  Button: ButtonEmbed,
  ImageEmbed,
  VideoEmbed,
  RiskLevel,
  Table: RichTextTable,
  RelatedGuides,
  // RelatedGuide is a child of RelatedGuides wrapper
  RelatedGuide: ({ slug }) => <div data-related-guide={slug} />,
  Section: SectionComponent,
  ChecklistItem: ChecklistItemMdx,
  CopyButton,
  Badge,
  ProtectionBadge,
  InlineChecklist,
};

export default mdxComponents;
