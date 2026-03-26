import { cn } from '@/lib/utils';

/**
 * Keystatic-safe inline wrapper: pass Tailwind classes via `className` and body as children.
 */
export default function StyledSpan({ className, children }) {
  return <span className={cn(className)}>{children}</span>;
}
