import React from 'react'
import Markdown from './Markdown'
import { cn } from '@/lib/utils'
import { storyblokEditable } from "@storyblok/react";

const RichTextTable = ({ 
  table, 
  caption, 
  className,
  blok,
  ...props
}) => {
  if (!table || !table.thead || !table.tbody) {
    return null
  }

  return (
    <div className={cn("table-wrapper", className)} {...storyblokEditable(blok)}>
      <table role="table">
        {caption && (
          <caption className="sr-only">
            <Markdown content={caption} inlineOnly={true} />
          </caption>
        )}
        <thead>
          <tr>
            {table.thead.map((th, index) => (
              <th key={index} scope="col">
                <Markdown content={th.value} inlineOnly={true} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.tbody.map((tr, rowIndex) => (
            <tr key={rowIndex}>
              {tr.body.map((td, colIndex) => (
                <td key={colIndex}>
                  <Markdown content={td.value} inlineOnly={true} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export { RichTextTable } 
