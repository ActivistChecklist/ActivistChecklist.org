import React from 'react'
import Markdown from './Markdown'
import { cn } from '@/lib/utils'

const RichTextTable = ({ 
  table, 
  caption, 
  className,
  block,
  ...props
}) => {
  if (!table || !table.thead || !table.tbody) {
    return null
  }

  return (
    <div className={cn("table-wrapper", className)}>
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
