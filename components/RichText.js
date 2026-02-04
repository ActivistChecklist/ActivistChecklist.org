import React from 'react';
import { render, NODE_HEADING } from 'storyblok-rich-text-react-renderer';
import { StoryblokComponent } from "@storyblok/react";
import { Alert } from "@/components/ui/alert";
import { RiskLevel } from "@/components/RiskLevel";
import { RichTextTable } from "@/components/RichTextTable";
import { HowTo } from "@/components/guides/HowTo";
import { Badge } from "@/components/ui/badge";
import { ProtectionBadge } from "@/components/guides/ProtectionBadge";
import { cn } from "@/lib/utils";
import CopyButton from "@/components/CopyButton";
import ButtonEmbed from "@/components/ButtonEmbed";
import VideoEmbed from "@/components/VideoEmbed";
import ImageEmbed from "@/components/ImageEmbed";
import RelatedGuides from "@/components/RelatedGuides";
import { InlineChecklist } from "@/components/guides/InlineChecklist";

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

// Wrapper components that can span multiple nodes in the rich text tree
const WRAPPER_COMPONENTS = {
  InlineChecklist: InlineChecklist
};

/**
 * Check if a React element or its text content contains a marker
 */
const containsMarker = (element, marker) => {
  if (typeof element === 'string') {
    return element.includes(marker);
  }
  if (React.isValidElement(element)) {
    const { children } = element.props;
    if (typeof children === 'string') {
      return children.includes(marker);
    }
    if (Array.isArray(children)) {
      return children.some(child => containsMarker(child, marker));
    }
    return children ? containsMarker(children, marker) : false;
  }
  if (Array.isArray(element)) {
    return element.some(child => containsMarker(child, marker));
  }
  return false;
};

/**
 * Remove a marker from a React element tree, returning new tree
 */
const removeMarker = (element, marker) => {
  if (typeof element === 'string') {
    return element.replace(marker, '').trim() || null;
  }
  if (React.isValidElement(element)) {
    const { children } = element.props;
    if (typeof children === 'string') {
      const newChildren = children.replace(marker, '').trim();
      // If the element is now empty, return null to remove it
      if (!newChildren) return null;
      return React.cloneElement(element, {}, newChildren);
    }
    if (Array.isArray(children)) {
      const newChildren = children
        .map(child => removeMarker(child, marker))
        .filter(child => child !== null && child !== '');
      if (newChildren.length === 0) return null;
      return React.cloneElement(element, {}, newChildren);
    }
    if (children) {
      const newChildren = removeMarker(children, marker);
      if (newChildren === null) return null;
      return React.cloneElement(element, {}, newChildren);
    }
    return element;
  }
  if (Array.isArray(element)) {
    return element
      .map(child => removeMarker(child, marker))
      .filter(child => child !== null && child !== '');
  }
  return element;
};

/**
 * Extract props from an opening tag like <InlineChecklist storageKey="my-key">
 */
const extractTagProps = (element, tagName) => {
  const props = {};
  const extractFromString = (str) => {
    const tagRegex = new RegExp(`<${tagName}([^>]*)>`);
    const match = str.match(tagRegex);
    if (match && match[1]) {
      const propsStr = match[1];
      const propsRegex = /(\w+)=["']([^"']*)["']/g;
      let propMatch;
      while ((propMatch = propsRegex.exec(propsStr)) !== null) {
        props[propMatch[1]] = propMatch[2];
      }
    }
  };

  if (typeof element === 'string') {
    extractFromString(element);
  } else if (React.isValidElement(element)) {
    const { children } = element.props;
    if (typeof children === 'string') {
      extractFromString(children);
    } else if (Array.isArray(children)) {
      children.forEach(child => {
        const childProps = extractTagProps(child, tagName);
        Object.assign(props, childProps);
      });
    } else if (children) {
      const childProps = extractTagProps(children, tagName);
      Object.assign(props, childProps);
    }
  }
  return props;
};

/**
 * Post-process rendered content to find wrapper component markers
 * and wrap the content between them in the appropriate component.
 * 
 * This handles cases like:
 * <p><InlineChecklist></p>
 * <ul><li>Item 1</li><li>Item 2</li></ul>
 * <p></InlineChecklist></p>
 */
const postProcessWrappers = (content) => {
  if (!content) return content;
  
  const children = React.Children.toArray(content);
  if (children.length === 0) return content;

  for (const [componentName, Component] of Object.entries(WRAPPER_COMPONENTS)) {
    const openTag = `<${componentName}`;
    const closeTag = `</${componentName}>`;
    
    let openIndex = -1;
    let closeIndex = -1;
    let openProps = {};
    
    // Find opening and closing tags
    for (let i = 0; i < children.length; i++) {
      if (openIndex === -1 && containsMarker(children[i], openTag)) {
        openIndex = i;
        openProps = extractTagProps(children[i], componentName);
      }
      if (openIndex !== -1 && containsMarker(children[i], closeTag)) {
        closeIndex = i;
        break;
      }
    }
    
    // If we found both tags, wrap the content
    if (openIndex !== -1 && closeIndex !== -1) {
      const before = children.slice(0, openIndex);
      const after = children.slice(closeIndex + 1);
      
      // Get content between markers
      let wrappedContent = children.slice(openIndex, closeIndex + 1);
      
      // Remove the opening tag from first element
      const openTagRegex = new RegExp(`<${componentName}[^>]*>`);
      wrappedContent[0] = removeMarker(wrappedContent[0], openTagRegex);
      
      // Remove the closing tag from last element  
      wrappedContent[wrappedContent.length - 1] = removeMarker(
        wrappedContent[wrappedContent.length - 1], 
        closeTag
      );
      
      // Filter out null/empty elements
      wrappedContent = wrappedContent.filter(el => el !== null && el !== '');
      
      // Create the wrapped component
      const wrappedElement = React.createElement(
        Component,
        { key: `${componentName}-${openIndex}`, ...openProps },
        wrappedContent
      );
      
      // Recursively process remaining content for more wrappers
      const result = [...before, wrappedElement, ...after];
      return postProcessWrappers(result);
    }
  }
  
  return children;
};

const blokResolvers = {
    alert: (props) => {
      return <Alert variant={props.type} title={props.title || null} blok={props} {...props} ><RichText document={ props.body} /></Alert>;
    },
    risk_level: (props) => {
      return <RiskLevel blok={props} level={props.level} body={props.body} {...props} />;
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
    },
    related_guides: (props) => {
      return <RelatedGuides blok={props} {...props} />;
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
  const rawContent = render(document, {
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

  // Post-process to handle wrapper components that span multiple nodes
  const content = postProcessWrappers(rawContent);

  if (noWrapper) {
    return <span className={cn("prose", className)} {...props}>{content}</span>;
  }

  return (
    <div className={cn("prose", className)} {...props}>
      {content}
    </div>
  );
}
