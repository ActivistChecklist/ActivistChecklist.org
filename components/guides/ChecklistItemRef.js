import React from 'react';
import { storyblokEditable } from '@storyblok/react';
import ChecklistItem from './ChecklistItem';

const ChecklistItemRef = ({ blok, expandTrigger, index }) => {

  // The reference_item is already resolved by Storyblok's resolve_relations
  const referencedItem = blok.reference_item;

  
  if (!referencedItem) {
    return (
      <div className="mb-4 p-4 text-muted-foreground" {...storyblokEditable(blok)}>
        No reference item found
      </div>
    );
  }

  // Render the referenced item using the ChecklistItem component
  return (
    <div class="checklist-item-ref"  {...storyblokEditable(blok)}>
      <ChecklistItem 
        blok={referencedItem.content}
        expandTrigger={expandTrigger}
        index={index}
        editable={false}
      />
    </div>
  );
};

export default ChecklistItemRef; 