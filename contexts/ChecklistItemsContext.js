import { createContext, useContext } from 'react';

/**
 * Provides a map of checklist item data keyed by slug.
 *
 * Shape: { [slug]: { frontmatter, serializedBody } }
 *
 * Used by the MDX <ChecklistItem slug="..."> wrapper to look up
 * item data when rendering guide pages from MDX.
 */
export const ChecklistItemsContext = createContext({});

export const useChecklistItems = () => useContext(ChecklistItemsContext);
