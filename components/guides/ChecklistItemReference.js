import React from 'react';
import { storyblokEditable, StoryblokComponent } from '@storyblok/react';
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const ChecklistItemReference = ({ blok, expandAll, index }) => {
  const items = blok.expanded_items || [];
  
  if (items.length === 0) {
    return (
      <Card className="mb-4 p-4 text-muted-foreground" {...storyblokEditable(blok)}>
        <CardHeader>No items found</CardHeader>
        <pre className="text-xs mt-2">{JSON.stringify(blok, null, 2)}</pre>
      </Card>
    );
  }

  return (
    <div {...storyblokEditable(blok)}>
      {items.map((item, idx) => {
        if (item.error) {
          return (
            <Card key={idx} className="mb-4 p-4 text-muted-foreground">
              <CardHeader>Error: {item.error}</CardHeader>
            </Card>
          );
        }

        return (
          <StoryblokComponent 
            key={item._uid || idx}
            blok={item}
            expandAll={expandAll}
            editable={false}
            index={index + idx}
          />
        );
      })}
    </div>
  );
};

export default ChecklistItemReference;
