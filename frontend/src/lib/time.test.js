import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { relativeTime, absoluteTime } from './time.js'

// Fixed base date: 2026-04-15T14:32:00Z
const BASE_DATE = new Date('2026-04-15T14:32:00Z')
const BASE_MS = BASE_DATE.getTime()

describe('relativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(BASE_DATE)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "just now" for a time 30 seconds ago', () => {
    const d = new Date(BASE_MS - 30_000)
    expect(relativeTime(d)).toBe('just now')
  })

  it('returns "just now" for a time 59 seconds ago', () => {
    const d = new Date(BASE_MS - 59_000)
    expect(relativeTime(d)).toBe('just now')
  })

  it('returns "10m ago" for a time 10 minutes ago', () => {
    const d = new Date(BASE_MS - 10 * 60_000)
    expect(relativeTime(d)).toBe('10m ago')
  })

  it('returns "2h ago" for a time 2 hours ago', () => {
    const d = new Date(BASE_MS - 2 * 60 * 60_000)
    expect(relativeTime(d)).toBe('2h ago')
  })

  it('returns "3d ago" for a time 3 days ago', () => {
    const d = new Date(BASE_MS - 3 * 24 * 60 * 60_000)
    expect(relativeTime(d)).toBe('3d ago')
  })

  it('returns "DD MMM" format for a time 12 days ago', () => {
    const d = new Date(BASE_MS - 12 * 24 * 60 * 60_000)
    // 12 days before 2026-04-15 is 2026-04-03
    const result = relativeTime(d)
    // Should match "DD MMM" pattern from en-GB locale
    expect(result).toMatch(/^\d{1,2}\s[A-Z][a-z]+$/)
    expect(result).toBe('3 Apr')
  })

  it('accepts an ISO string as input', () => {
    const iso = new Date(BASE_MS - 5 * 60_000).toISOString()
    expect(relativeTime(iso)).toBe('5m ago')
  })

  it('returns empty string for null', () => {
    expect(relativeTime(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(relativeTime(undefined)).toBe('')
  })
})

describe('absoluteTime', () => {
  it('formats a Date object as "DD MMM YYYY at HH:MM" in local time', () => {
    // Build the expected string using the same locale functions the implementation uses,
    // so the test is timezone-agnostic.
    const expected =
      BASE_DATE.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' at ' +
      BASE_DATE.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
    expect(absoluteTime(BASE_DATE)).toBe(expected)
  })

  it('formats an ISO string the same as the equivalent Date object', () => {
    expect(absoluteTime('2026-04-15T14:32:00Z')).toBe(absoluteTime(BASE_DATE))
  })

  it('output matches expected pattern "DD MMM YYYY at HH:MM"', () => {
    const result = absoluteTime(BASE_DATE)
    // Pattern: 1-2 digit day, space, 3-letter month, space, 4-digit year, " at ", HH:MM
    expect(result).toMatch(/^\d{2}\s[A-Z][a-z]{2}\s\d{4}\sat\s\d{2}:\d{2}$/)
  })

  it('returns empty string for null', () => {
    expect(absoluteTime(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(absoluteTime(undefined)).toBe('')
  })
})
