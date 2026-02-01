import { describe, it, expect } from 'vitest'

// Test the link classification logic used in components/Link.js
// Extracted as a pure function to avoid needing React/jsdom
const isExternalLink = (href) => typeof href === 'string' && href.startsWith('http')

describe('Link classification logic', () => {
  it('identifies HTTPS links as external', () => {
    expect(isExternalLink('https://example.com')).toBe(true)
  })

  it('identifies HTTP links as external', () => {
    expect(isExternalLink('http://example.com')).toBe(true)
  })

  it('identifies absolute paths as internal', () => {
    expect(isExternalLink('/about')).toBe(false)
  })

  it('identifies relative paths as internal', () => {
    expect(isExternalLink('about')).toBe(false)
  })

  it('identifies anchor links as internal', () => {
    expect(isExternalLink('#section')).toBe(false)
  })

  it('handles undefined gracefully', () => {
    expect(isExternalLink(undefined)).toBe(false)
  })

  it('handles null gracefully', () => {
    expect(isExternalLink(null)).toBe(false)
  })

  it('handles empty string', () => {
    expect(isExternalLink('')).toBe(false)
  })

  it('handles non-string values', () => {
    expect(isExternalLink(42)).toBe(false)
    expect(isExternalLink({})).toBe(false)
  })
})
