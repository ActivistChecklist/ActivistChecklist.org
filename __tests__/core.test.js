import { describe, it, expect, vi } from 'vitest'
import { slugify, truncateText, renderRichTextTreeAsPlainText, storyblokFetch } from '../utils/core'

describe('slugify', () => {
  it('converts basic text to slug', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('removes special characters', () => {
    expect(slugify('Hello, World!')).toBe('hello-world')
  })

  it('collapses multiple spaces into single dash', () => {
    expect(slugify('Hello   World')).toBe('hello-world')
  })

  it('trims leading and trailing dashes', () => {
    expect(slugify('-hello-world-')).toBe('hello-world')
  })

  it('handles numbers', () => {
    expect(slugify('Step 1: Do this')).toBe('step-1-do-this')
  })

  it('respects maxLength config', () => {
    const result = slugify('hello beautiful world', { maxLength: 8 })
    expect(result.length).toBeLessThanOrEqual(8)
  })

  it('respects maxWords config', () => {
    expect(slugify('hello beautiful world', { maxWords: 2 })).toBe('hello-beautiful')
  })

  it('handles empty string', () => {
    expect(slugify('')).toBe('')
  })

  it('handles strings with only special characters', () => {
    expect(slugify('!@#$%')).toBe('')
  })
})

describe('truncateText', () => {
  it('returns empty string for null', () => {
    expect(truncateText(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(truncateText(undefined)).toBe('')
  })

  it('returns empty string for empty string', () => {
    expect(truncateText('')).toBe('')
  })

  it('returns original text when shorter than maxLength', () => {
    expect(truncateText('short text')).toBe('short text')
  })

  it('truncates and adds ellipsis when exceeding default maxLength', () => {
    const longText = 'a'.repeat(200)
    const result = truncateText(longText)
    expect(result.length).toBeLessThanOrEqual(153) // 150 + '...'
    expect(result).toMatch(/\.\.\.$/u)
  })

  it('respects custom maxLength', () => {
    const result = truncateText('hello world', 5)
    expect(result).toBe('hello...')
  })

  it('returns text exactly at maxLength without truncation', () => {
    const text = 'a'.repeat(150)
    expect(truncateText(text)).toBe(text)
  })
})

describe('renderRichTextTreeAsPlainText', () => {
  it('returns empty string for null', () => {
    expect(renderRichTextTreeAsPlainText(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(renderRichTextTreeAsPlainText(undefined)).toBe('')
  })

  it('extracts text from a text node', () => {
    expect(renderRichTextTreeAsPlainText({ type: 'text', text: 'hello' })).toBe('hello')
  })

  it('recursively processes content arrays', () => {
    const tree = {
      content: [
        { type: 'text', text: 'hello' },
        { type: 'text', text: 'world' }
      ]
    }
    expect(renderRichTextTreeAsPlainText(tree)).toBe('hello world')
  })

  it('handles doc type', () => {
    const tree = {
      type: 'doc',
      content: [
        {
          content: [
            { type: 'text', text: 'paragraph text' }
          ]
        }
      ]
    }
    expect(renderRichTextTreeAsPlainText(tree)).toBe('paragraph text')
  })

  it('handles nested content', () => {
    const tree = {
      type: 'doc',
      content: [
        {
          content: [
            { type: 'text', text: 'first' }
          ]
        },
        {
          content: [
            { type: 'text', text: 'second' }
          ]
        }
      ]
    }
    expect(renderRichTextTreeAsPlainText(tree)).toBe('first second')
  })

  it('filters empty strings from output', () => {
    const tree = {
      content: [
        { type: 'text', text: '' },
        { type: 'text', text: 'hello' }
      ]
    }
    // Empty text returns '', which gets filtered
    expect(renderRichTextTreeAsPlainText(tree)).toBe('hello')
  })
})

describe('storyblokFetch', () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})

  it('returns result on first successful call', async () => {
    const result = await storyblokFetch(() => Promise.resolve({ data: 'ok' }))
    expect(result).toEqual({ data: 'ok' })
  })

  it('retries on 429 and eventually succeeds', async () => {
    let calls = 0
    const apiCall = () => {
      calls++
      if (calls < 3) {
        const err = new Error('Too Many Requests')
        err.status = 429
        return Promise.reject(err)
      }
      return Promise.resolve({ data: 'ok' })
    }

    const result = await storyblokFetch(apiCall, { baseDelay: 10 })
    expect(result).toEqual({ data: 'ok' })
    expect(calls).toBe(3)
  })

  it('retries on 500 errors', async () => {
    let calls = 0
    const apiCall = () => {
      calls++
      if (calls < 2) {
        const err = new Error('Internal Server Error')
        err.status = 500
        return Promise.reject(err)
      }
      return Promise.resolve({ data: 'ok' })
    }

    const result = await storyblokFetch(apiCall, { baseDelay: 10 })
    expect(result).toEqual({ data: 'ok' })
    expect(calls).toBe(2)
  })

  it('throws immediately on non-retryable errors (e.g. 404)', async () => {
    const err = new Error('Not Found')
    err.status = 404
    await expect(
      storyblokFetch(() => Promise.reject(err), { baseDelay: 10 })
    ).rejects.toThrow('Not Found')
  })

  it('throws after exhausting all retries', async () => {
    const err = new Error('Too Many Requests')
    err.status = 429
    await expect(
      storyblokFetch(() => Promise.reject(err), { maxRetries: 2, baseDelay: 10 })
    ).rejects.toThrow('Too Many Requests')
  })
})
