import { describe, it, expect } from 'vitest'
import { cn, formatRelativeDate } from '../lib/utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz')
  })

  it('handles undefined and null', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar')
  })

  it('resolves conflicting Tailwind classes', () => {
    // tailwind-merge should keep the last conflicting class
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('resolves conflicting Tailwind padding classes', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('merges non-conflicting Tailwind classes', () => {
    expect(cn('px-2', 'py-4')).toBe('px-2 py-4')
  })

  it('handles empty input', () => {
    expect(cn()).toBe('')
  })
})

describe('formatRelativeDate', () => {
  it('returns empty string for falsy input', () => {
    expect(formatRelativeDate(null)).toBe('')
    expect(formatRelativeDate(undefined)).toBe('')
    expect(formatRelativeDate('')).toBe('')
  })

  it('returns "Today" for today\'s date', () => {
    const today = new Date()
    expect(formatRelativeDate(today.toISOString())).toBe('Today')
  })

  it('returns "Yesterday" for yesterday\'s date', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    expect(formatRelativeDate(yesterday.toISOString())).toBe('Yesterday')
  })

  it('returns "N days ago" for 2-7 days ago', () => {
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    expect(formatRelativeDate(threeDaysAgo.toISOString())).toBe('3 days ago')
  })

  it('returns formatted date for dates older than 7 days', () => {
    const twoWeeksAgo = new Date()
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
    const result = formatRelativeDate(twoWeeksAgo.toISOString())
    // Should be "Mon DD" format (e.g. "Jan 15")
    expect(result).toMatch(/^[A-Z][a-z]{2} \d{1,2}/)
  })

  it('includes year for dates from a different year', () => {
    const oldDate = new Date('2020-06-15T12:00:00Z')
    const result = formatRelativeDate(oldDate.toISOString())
    // Should include the year
    expect(result).toContain('2020')
  })
})
