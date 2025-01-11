import React from "react";
import { storyblokEditable } from "@storyblok/react";
import { RichText } from "../RichText";
import { useDebug } from '../../contexts/DebugContext'
import { useLayout } from "@/contexts/LayoutContext";
import { useEffect } from "react";
import { MetaBar, getDateMetaItem } from "@/components/ui/meta-bar";

function Page({ blok, story }) {
  const { setDebugData } = useDebug() || {}
  const { setSidebarType } = useLayout();

  useEffect(() => {
    setSidebarType('navigation');
  }, []);

  if (setDebugData) {
    setDebugData(blok)
  }

  const metaBarItems = [
    getDateMetaItem(story.updated_at)
  ];

  return (
    <>  
      <h1 className="mb-6">
        {story.name}
      </h1>
      <MetaBar items={metaBarItems} />
      <div className="prose prose-slate max-w-none" {...storyblokEditable(blok)}>
        <RichText document={blok.body} />
      </div>
    </>
  );
}

export default Page;
