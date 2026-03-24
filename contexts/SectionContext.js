import { createContext, useContext } from 'react';

/**
 * Provides expand/collapse-all state from a <Section> to its
 * <ChecklistItem> children in MDX mode.
 *
 * Shape: { expandTrigger: { timestamp, shouldExpand } | null, triggerExpand: (shouldExpand) => void }
 */
export const SectionContext = createContext({
  expandTrigger: null,
  triggerExpand: () => {},
});

export const useSectionContext = () => useContext(SectionContext);
