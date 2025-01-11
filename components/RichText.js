import React from 'react';
import { render, NODE_HEADING } from 'storyblok-rich-text-react-renderer';
import { StoryblokComponent } from "@storyblok/react";
import { Alert } from "@/components/ui/alert";
import { RichTextTable } from "@/components/RichTextTable";
import { HowTo } from "@/components/guides/HowTo";
import { Badge } from "@/components/ui/badge";
import { ProtectionBadge } from "@/components/guides/ProtectionBadge";
import { cn } from "@/lib/utils";

const INLINE_COMPONENTS = {
  Badge,
  ProtectionBadge
};

const parseClasses = (text) => {
  // Parse classes like {className}text{/}
  const regex = /\{([^}]+)\}(.*?)\{\/\}/g;
  let lastIndex = 0;
  const elements = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(text.slice(lastIndex, match.index));
    }

    const [_, className, content] = match;
    elements.push(
      React.createElement('span', { className, key: match.index }, content)
    );

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }

  return elements.length === 0 ? text : elements;
};

const parseComponents = (text) => {
  // Match both self-closing tags and regular tags
  const regex = /<([A-Z][a-zA-Z]*)(.*?)(\/?>)(?:(.*?)<\/\1>)?/g;
  let lastIndex = 0;
  const elements = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(text.slice(lastIndex, match.index));
    }

    const [_, componentName, propsString, closing, content] = match;
    const Component = INLINE_COMPONENTS[componentName];
    
    if (Component) {
      // Parse props string
      const props = {};
      const propsRegex = /(\w+)=["'](.*?)["']/g;
      let propMatch;
      while ((propMatch = propsRegex.exec(propsString)) !== null) {
        const [_, key, value] = propMatch;
        props[key] = value;
      }

      elements.push(
        React.createElement(Component, { key: match.index, ...props }, content)
      );
    } else {
      // If component not found, just add the text as is
      elements.push(match[0]);
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }

  return elements.length === 0 ? text : elements;
};

const blokResolvers = {
    alert: (props) => {
      return <Alert variant={props.type} title={props.title || null} blok={props} {...props} ><RichText document={ props.body} /></Alert>;
    },
    table: (props) => {
      return <RichTextTable blok={props} {...props} />;
    },
    how_to: (props) => {
      return <HowTo blok={props} {...props} />;
    }
}

const markResolvers = {
  bold: (children) => <strong>{children}</strong>,
  italic: (children) => <em>{children}</em>,
  strike: (children) => <del>{children}</del>,
  code: (children) => <code className="bg-gray-100 rounded px-1">{children}</code>,
  link: (children, props) => {
    const isExternal = props.href?.startsWith('http') || props.href?.startsWith('https')
    return isExternal ? (
      <a href={props.href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ) : (
      <a href={props.href} target={props.target}>{children}</a>
    )
  },
  underline: (children) => <u>{children}</u>,
}

const nodeResolvers = {
  heading: (children, { level }) => {
    const className = `heading-${level}`;
    return React.createElement(`h${level}`, { className }, children);
  }
};

export function RichText({ document, className, noWrapper = false, ...props }) {
  const content = render(document, {
    nodeResolvers,
    markResolvers,
    blokResolvers: {
      ...blokResolvers
    },
    textResolver: (text) => {
      const withComponents = parseComponents(text);
      
      // If the result is an array (components were found), process each text element for classes
      if (Array.isArray(withComponents)) {
        return withComponents.map((element, index) => {
          if (typeof element === 'string') {
            return parseClasses(element);
          }
          return element;
        }).flat();
      }
      
      // If no components were found, just parse classes
      return parseClasses(withComponents);
    },
    defaultBlokResolver: (name, props) => {
      const blok = { ...props, component: name };
      return <StoryblokComponent blok={blok} key={props._uid} />;
    }
  });

  if (noWrapper) {
    return content;
  }

  return (
    <div className={cn("prose", className)} {...props}>
      {content}
    </div>
  );
}
