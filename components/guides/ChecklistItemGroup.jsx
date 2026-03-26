'use client';

/**
 * Transparent wrapper for one or more `<ChecklistItem />` blocks.
 * Used with Keystatic’s `repeating` content component so editors get add/remove UI.
 * On the site it renders the same as bare sibling checklist items.
 */
function ChecklistItemGroup({ children }) {
  return <>{children}</>;
}

ChecklistItemGroup.isChecklistItemGroup = true;

export default ChecklistItemGroup;
