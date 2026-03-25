// @ts-nocheck
import { config, collection, fields } from '@keystatic/core';
import { wrapper, block } from '@keystatic/core/content-components';

// ─── Shared content components ────────────────────────────────────────────────

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
});

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
    size: fields.select({
      label: 'Size',
      options: [
        { label: 'Small', value: 'sm' },
        { label: 'Default', value: 'default' },
        { label: 'Large', value: 'lg' },
        { label: 'Extra Large', value: 'xl' },
      ],
      defaultValue: 'default',
    }),
    target: fields.select({
      label: 'Target',
      options: [
        { label: 'Same tab', value: '_self' },
        { label: 'New tab', value: '_blank' },
      ],
      defaultValue: '_self',
    }),
    alignment: fields.select({
      label: 'Alignment',
      options: [
        { label: 'Left', value: 'left' },
        { label: 'Center', value: 'center' },
        { label: 'Right', value: 'right' },
      ],
      defaultValue: 'left',
    }),
    icon: fields.text({ label: 'Icon name (optional)' }),
    iconPosition: fields.select({
      label: 'Icon Position',
      options: [
        { label: 'Left', value: 'left' },
        { label: 'Right', value: 'right' },
      ],
      defaultValue: 'left',
    }),
    download: fields.checkbox({ label: 'Download link?', defaultValue: false }),
  },
});

const howToComponent = wrapper({
  label: 'How To',
  description: 'Step-by-step instructions (can contain Alerts and Buttons)',
  schema: {
    title: fields.text({ label: 'Title', validation: { isRequired: true } }),
  },
});

const imageEmbedComponent = wrapper({
  label: 'Image',
  description: 'Image with optional caption',
  schema: {
    src: fields.text({ label: 'Image path', validation: { isRequired: true } }),
    alt: fields.text({ label: 'Alt text', validation: { isRequired: true } }),
    size: fields.select({
      label: 'Size',
      options: [
        { label: 'Extra Small', value: 'xs' },
        { label: 'Small', value: 'small' },
        { label: 'Medium', value: 'medium' },
        { label: 'Large', value: 'large' },
        { label: 'Full', value: 'full' },
      ],
      defaultValue: 'medium',
    }),
    alignment: fields.select({
      label: 'Alignment',
      options: [
        { label: 'Left', value: 'left' },
        { label: 'Center', value: 'center' },
        { label: 'Right', value: 'right' },
      ],
      defaultValue: 'left',
    }),
  },
});

const videoEmbedComponent = wrapper({
  label: 'Video',
  description: 'Video embed with optional caption',
  schema: {
    src: fields.text({ label: 'Video path', validation: { isRequired: true } }),
  },
});

const copyButtonComponent = block({
  label: 'Copy Button',
  description: 'Text with a copy-to-clipboard button',
  schema: {
    text: fields.text({ label: 'Text to copy' }),
  },
});

// Shared set used in most collections
const contentComponents = {
  Alert: alertComponent,
  HowTo: howToComponent,
  Button: buttonComponent,
  ImageEmbed: imageEmbedComponent,
  VideoEmbed: videoEmbedComponent,
  CopyButton: copyButtonComponent,
};

// ─── Badge components (checklist items only) ──────────────────────────────────

const badgeComponent = block({
  label: 'Badge',
  schema: {
    variant: fields.text({ label: 'Variant' }),
    children: fields.text({ label: 'Text' }),
  },
});

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
});

// ─── Guide-specific components ────────────────────────────────────────────────

const sectionComponent = wrapper({
  label: 'Section',
  description: 'Guide section that groups checklist items',
  schema: {
    title: fields.text({ label: 'Section Title', validation: { isRequired: true } }),
    slug: fields.text({ label: 'Section Slug (used for URL anchors)', validation: { isRequired: true } }),
  },
});

const checklistItemComponent = block({
  label: 'Checklist Item',
  description: 'Reference to a checklist item by slug',
  schema: {
    // Note: fields.relationship() is the ideal here but POC verified it works
    // inside content component blocks. If it doesn't, fall back to fields.text().
    slug: fields.relationship({
      label: 'Checklist Item',
      collection: 'checklistItems',
    }),
  },
});

const riskLevelComponent = wrapper({
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
        { label: 'Single Line', value: 'single_line' },
        { label: 'For You', value: 'for_you' },
        { label: 'For You If', value: 'for_you_if' },
      ],
      defaultValue: 'default',
    }),
  },
});

const relatedGuidesComponent = wrapper({
  label: 'Related Guides',
  description: 'Block of related guide cards',
  schema: {},
});

const relatedGuideComponent = block({
  label: 'Related Guide',
  description: 'A single related guide reference',
  schema: {
    slug: fields.relationship({
      label: 'Guide',
      collection: 'guides',
    }),
  },
});

// ─── Config ───────────────────────────────────────────────────────────────────

export default config({
  storage: {
    // Local mode unless GitHub env vars are configured
    kind: process.env.KEYSTATIC_GITHUB_CLIENT_ID ? 'github' : 'local',
    repo: {
      owner: process.env.KEYSTATIC_GITHUB_REPO_OWNER || 'ActivistChecklist',
      name: process.env.KEYSTATIC_GITHUB_REPO_NAME || 'ActivistChecklist.org',
    },
  },

  ui: {
    brand: {
      name: 'Activist Checklist CMS',
    },
  },

  collections: {
    // ── Checklist Items ─────────────────────────────────────────────────────
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

    // ── Guides ──────────────────────────────────────────────────────────────
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
        body: fields.mdx({
          label: 'Guide Content',
          components: {
            ...contentComponents,
            Section: sectionComponent,
            ChecklistItem: checklistItemComponent,
            RiskLevel: riskLevelComponent,
            RelatedGuides: relatedGuidesComponent,
            RelatedGuide: relatedGuideComponent,
          },
        }),
      },
    }),

    // ── Pages ───────────────────────────────────────────────────────────────
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

    // ── News ────────────────────────────────────────────────────────────────
    news: collection({
      label: 'News',
      slugField: 'title',
      path: 'content/en/news/*',
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
          components: {},
        }),
      },
    }),

    // ── Changelog ───────────────────────────────────────────────────────────
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
});
