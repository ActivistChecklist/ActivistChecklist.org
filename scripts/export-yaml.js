import yaml from 'js-yaml'

// Define how different components should be handled
export const componentTypes = {
  yamlNested: new Set(['guide', 'page', 'section-header', 'checklist-item']),
  markdown: new Set(['rich-text', 'markdown']),
  jsx: new Set(['Alert', 'Badge', 'Table'])
}

/**
 * Convert a story object to YAML format
 */
export function storyToYaml(story, richTextToMarkdown) {
  // Create a map of lowercase to actual casing for JSX components
  const jsxComponentMap = new Map(
    Array.from(componentTypes.jsx).map(comp => [comp.toLowerCase(), comp])
  )

  // Helper to clean trailing newlines from string content
  const cleanNewlines = (content) => {
    if (typeof content === 'string') {
      // First trim any whitespace
      content = content.trim()
      // Replace multiple newlines with single newlines
      content = content.replace(/\n\s*\n+/g, '\n')
      // Remove trailing newlines
      content = content.replace(/\n+$/, '')
      // Remove leading newlines
      content = content.replace(/^\n+/, '')
      return content
    }
    return content
  }

  // Helper to process content fields
  const processContent = (obj) => {
    if (!obj) return obj

    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map(item => processContent(item))
    }

    // Handle objects
    if (typeof obj === 'object') {
      // Handle components
      if (obj.component) {
        // Handle table component
        if (obj.component === 'table') {
          const tableData = obj.table
          if (!tableData) return ''

          const rows = []
          
          // Add header
          if (tableData.thead) {
            const headerRow = tableData.thead.map(h => h.value.replace(/\n/g, '\\n')).join(' | ')
            rows.push(`| ${headerRow} |`)
            rows.push(`| ${tableData.thead.map(() => '---').join(' | ')} |`)
          }

          // Add body rows
          if (tableData.tbody) {
            tableData.tbody.forEach(row => {
              const cells = row.body.map(col => col.value.replace(/\n/g, '\\n')).join(' | ')
              rows.push(`| ${cells} |`)
            })
          }

          // Join rows with single newlines and wrap in Table component without extra newlines
          return `<Table className="${obj.className || ''}">${rows.join('\n')}</Table>`
        }

        // Handle alert/jsx components
        const actualComponentName = jsxComponentMap.get(obj.component.toLowerCase())
        if (actualComponentName) {
          const attrs = Object.entries(obj)
            .filter(([key]) => key !== 'component' && key !== 'body' && key !== '_uid')
            .map(([key, value]) => {
              if (typeof value === 'object') return ''
              return value ? ` ${key}="${value}"` : ''
            })
            .join('')
          
          const body = obj.body?.type === 'doc' 
            ? richTextToMarkdown(obj.body)
            : processContent(obj.body)

          return `<${actualComponentName}${attrs}>\n${body}\n</${actualComponentName}>`
        }

        // YAML nested components
        if (componentTypes.yamlNested.has(obj.component)) {
          const processed = { component: obj.component }
          if (obj.title !== undefined) processed.title = obj.title
          
          for (const [key, value] of Object.entries(obj)) {
            if (key !== 'component' && key !== 'title') {
              const processedValue = processContent(value)
              if (processedValue !== undefined && processedValue !== null && processedValue !== '') {
                processed[key] = processedValue
              }
            }
          }
          return processed
        }

        // Markdown components
        if (componentTypes.markdown.has(obj.component)) {
          return obj.body?.type === 'doc' 
            ? richTextToMarkdown(obj.body)
            : processContent(obj.body)
        }
      }

      // Handle rich text fields
      if (obj.type === 'doc' && obj.content) {
        const processedContent = obj.content.map(item => {
          if (item.type === 'blok' && item.attrs?.body) {
            // Process each item in the blok's body array and preserve the JSX/HTML
            const blokContent = item.attrs.body.map(bodyItem => {
              const processed = processContent(bodyItem)
              return cleanNewlines(processed)
            }).join('')
            return { type: 'paragraph', content: [{ type: 'text', text: blokContent }] }
          }
          return item
        })

        return richTextToMarkdown({ ...obj, content: processedContent })
      }

      // Handle bloks at the top level
      if (obj.type === 'blok' && obj.attrs?.body) {
        return obj.attrs.body.map(item => {
          const processed = processContent(item)
          return cleanNewlines(processed)
        }).join('')
      }

      // Handle nested objects
      const processed = {}
      for (const [key, value] of Object.entries(obj)) {
        const processedValue = processContent(value)
        if (processedValue !== undefined && processedValue !== null && processedValue !== '') {
          processed[key] = processedValue
        }
      }
      return processed
    }

    return obj
  }

  // Process the story content
  const processed = {
    ...story,
    content: processContent(story.content)
  }

  // Convert to YAML with proper formatting
  return yaml.dump(processed, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
    noCompatMode: true,
    quotingType: '"',
    styles: {
      '!!str': 'literal'  // Use literal style (|) for strings with newlines
    },
    forceQuotes: false,
    // Custom string presenter to handle newlines more strictly
    replacer: (key, value) => {
      if (typeof value === 'string') {
        // First trim any whitespace from start/end
        value = value.trim()
        // Replace multiple newlines with single newlines
        value = value.replace(/\n\s*\n+/g, '\n')
        // Remove any trailing newlines
        value = value.replace(/\n+$/, '')
        // Remove any leading newlines
        value = value.replace(/^\n+/, '')
        return value
      }
      return value
    }
  })
} 