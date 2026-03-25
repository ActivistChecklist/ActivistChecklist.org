import { cn } from '@/lib/utils';

const toneClass = {
  danger: 'bg-destructive text-destructive-foreground font-bold',
  success: 'text-success',
  default: '',
};

/** Beats `.prose code { @apply bg-muted … }` so danger/success colors show on &lt;code&gt;. */
const toneClassCode = {
  danger:
    '!bg-destructive !text-destructive-foreground !font-bold before:!content-none after:!content-none',
  success: '!bg-transparent !text-success before:!content-none after:!content-none',
  default: '!bg-transparent before:!content-none after:!content-none',
};

/**
 * Inline emphasis for MDX (replaces raw &lt;span className=...&gt; in Keystatic-friendly content).
 * Prefer the `text` prop so the admin editor stays self-contained.
 * By default the text is wrapped in &lt;code&gt; (URL fragments, query strings). Set `code={false}` for plain prose.
 */
export default function Tone({ tone = 'danger', text, children, code = true }) {
  const content = text != null && text !== '' ? text : children;
  const key = tone in toneClass ? tone : 'default';
  if (code) {
    return (
      <code
        className={cn(
          'rounded px-1 py-0.5 font-mono text-sm',
          toneClassCode[key],
        )}
      >
        {content}
      </code>
    );
  }
  return <span className={cn(toneClass[key])}>{content}</span>;
}
