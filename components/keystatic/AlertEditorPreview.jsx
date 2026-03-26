'use client';

import { Alert } from '@/components/ui/alert';

/**
 * Keystatic MDX preview: same Alert as the live site (Alert.module.css + prose).
 * Children stay editable in the rich-text editor.
 */
export default function AlertEditorPreview({ type, title, children }) {
  const variant = type || 'default';
  return (
    <Alert variant={variant} title={title || undefined} className="my-2 max-w-none">
      {children}
    </Alert>
  );
}
