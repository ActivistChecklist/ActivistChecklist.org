import React from 'react';
import { render, NODE_HEADING } from 'storyblok-rich-text-react-renderer';
import { StoryblokComponent } from "@storyblok/react";
import { Alert } from "@/components/ui/alert";
import { RichTextTable } from "@/components/RichTextTable";
import { HowTo } from "@/components/guides/HowTo";
import { Badge } from "@/components/ui/badge";
import { ProtectionBadge } from "@/components/guides/ProtectionBadge";
import { cn } from "@/lib/utils";
import CopyButton from "@/components/CopyButton";
import ButtonEmbed from "@/components/ButtonEmbed";
import VideoEmbed from "@/components/VideoEmbed";
import ImageEmbed from "@/components/ImageEmbed";

const INLINE_COMPONENTS = {
  Badge,
  ProtectionBadge,
  CopyButton
};

const parseClasses = (text) => {
  // Parse classes like {className}text{/} with support for nested braces
  const elements = [];
  let i = 0;
  
  while (i < text.length) {
    const openBraceIndex = text.indexOf('{', i);
    
    if (openBraceIndex === -1) {
      // No more opening braces, add the rest of the text
      if (i < text.length) {
        elements.push(text.slice(i));
      }
      break;
    }
    
    // Add text before the opening brace
    if (openBraceIndex > i) {
      elements.push(text.slice(i, openBraceIndex));
    }
    
    // Find the matching closing brace for the className
    let classNameEnd = openBraceIndex + 1;
    let braceCount = 1;
    
    while (classNameEnd < text.length && braceCount > 0) {
      if (text[classNameEnd] === '{') {
        braceCount++;
      } else if (text[classNameEnd] === '}') {
        braceCount--;
      }
      classNameEnd++;
    }
    
    if (braceCount > 0) {
      // Unmatched opening brace, treat as literal text
      elements.push(text[openBraceIndex]);
      i = openBraceIndex + 1;
      continue;
    }
    
    const className = text.slice(openBraceIndex + 1, classNameEnd - 1);
    
    // Find the matching closing {/} tag by tracking nesting level
    let closingTagIndex = -1;
    let nestingLevel = 1; // We're inside one tag already
    let searchIndex = classNameEnd;
    
    while (searchIndex < text.length && nestingLevel > 0) {
      const nextOpenIndex = text.indexOf('{', searchIndex);
      const nextCloseIndex = text.indexOf('{/}', searchIndex);
      
      // If no more closing tags, we're done (unmatched)
      if (nextCloseIndex === -1) {
        break;
      }
      
      // If there's an opening tag before the next closing tag, it's a nested opening
      if (nextOpenIndex !== -1 && nextOpenIndex < nextCloseIndex) {
        // Check if this is a class tag (has a closing brace after it)
        const possibleClassEnd = text.indexOf('}', nextOpenIndex + 1);
        if (possibleClassEnd !== -1 && possibleClassEnd < nextCloseIndex) {
          nestingLevel++;
          searchIndex = possibleClassEnd + 1;
        } else {
          searchIndex = nextOpenIndex + 1;
        }
      } else {
        // This is a closing tag
        nestingLevel--;
        if (nestingLevel === 0) {
          closingTagIndex = nextCloseIndex;
        }
        searchIndex = nextCloseIndex + 3; // Move past {/}
      }
    }
    
    if (closingTagIndex === -1) {
      // No matching closing tag found, treat as literal text
      elements.push(text.slice(openBraceIndex, classNameEnd));
      i = classNameEnd;
      continue;
    }
    
    // Extract content between className} and {/}
    const content = text.slice(classNameEnd, closingTagIndex);
    
    // Recursively parse the content for nested tags
    const parsedContent = parseClasses(content);
    
    elements.push(
      React.createElement('span', { 
        className, 
        key: `${openBraceIndex}-${closingTagIndex}` 
      }, parsedContent)
    );
    
    i = closingTagIndex + 3; // Move past {/}
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
    },
    button: (props) => {
      return <ButtonEmbed {...props} className={`my-2 mr-2 ${props.className || ''}`} />;
    },
    video_embed: (props) => {
      return <VideoEmbed {...props} className={`my-4 ${props.className || ''}`} />;
    },
    image_embed: (props) => {
      return <ImageEmbed {...props} className={`my-4 ${props.className || ''}`} />;
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
    nodeResolvers: {
      ...nodeResolvers,
      paragraph: (children, props) => {
        // If noWrapper is true, return children without <p> wrapper
        if (noWrapper) {
          return children;
        }
        // Default behavior: wrap in <p> tag
        return React.createElement('p', {}, children);
      }
    },
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
    return <span className={cn("prose", className)} {...props}>{content}</span>;
  }

  return (
    <div className={cn("prose", className)} {...props}>
      {content}
    </div>
  );
}
