'use client'

import { useState, useRef, useEffect } from 'react'
import { IoCopyOutline, IoCheckmarkSharp } from "react-icons/io5"
import { Button } from '@/components/ui/button'

export default function CopyButton({ className = '' }) {
  const [copied, setCopied] = useState(false)
  const buttonRef = useRef(null)
  const timeoutRef = useRef(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const formatTextContent = (element) => {
    let text = ''
    const childNodes = element.childNodes

    for (const node of childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const trimmedText = node.textContent.trim()
        if (trimmedText) {
          text += trimmedText + '\n\n'
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        // Handle list items
        if (node.tagName === 'UL') {
          const items = node.querySelectorAll('li')
          items.forEach(item => {
            text += '• ' + item.textContent.trim() + '\n'
          })
          text += '\n' // Add an extra line break after the list
        } else if (node.tagName === 'P') {
          text += node.textContent.trim() + '\n\n'
        } else if (node.tagName !== 'BUTTON') { // Skip the copy button itself
          text += formatTextContent(node)
        }
      }
    }
    return text
  }

  const copyToClipboard = async () => {
    try {
      // Get the grandparent element's text content
      const grandparentElement = buttonRef.current.parentElement.parentElement
      const formattedText = formatTextContent(grandparentElement)
        .replace(/Copy|Copied/g, '') // Remove "Copy" and "Copied" text
        .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double newlines
        .trim()

      // Use modern clipboard API
      await navigator.clipboard.writeText(formattedText)
      
      // Show success state
      setCopied(true)
      
      // Reset after 2 seconds
      timeoutRef.current = setTimeout(() => {
        setCopied(false)
      }, 3000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <Button
      ref={buttonRef}
      onClick={copyToClipboard}
      variant="muted"
      size="sm"
      className={className}
      aria-label="Copy to clipboard"
    >
      {copied ? (
        <>
          <IoCheckmarkSharp />
          Copied
        </>
      ) : (
        <>
          <IoCopyOutline />
          Copy
        </>
      )}
    </Button>
  )
} 