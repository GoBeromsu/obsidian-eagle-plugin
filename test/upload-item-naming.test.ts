import { describe, expect, it } from 'vitest'

import { resolveItemName } from '../src/utils/item-naming'

const CONTEXT = { originalName: 'my-photo', noteName: 'My Note' }

describe('resolveItemName', () => {
  it('replaces {originalName} with the original filename', () => {
    expect(resolveItemName('{originalName}', CONTEXT)).toBe('my-photo')
  })

  it('replaces {noteName} with the active note name', () => {
    expect(resolveItemName('{noteName}', CONTEXT)).toBe('My Note')
  })

  it('replaces {date} with a YYYY-MM-DD formatted string', () => {
    const result = resolveItemName('{date}', CONTEXT)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('replaces {uuid} with a short random ID', () => {
    const result = resolveItemName('{uuid}', CONTEXT)
    expect(result.length).toBeGreaterThan(0)
    expect(result).toMatch(/^[a-z0-9]+$/)
  })

  it('resolves combined templates', () => {
    const result = resolveItemName('{noteName}-{originalName}', CONTEXT)
    expect(result).toBe('My Note-my-photo')
  })

  it('falls back to originalName when template resolves to empty string', () => {
    expect(resolveItemName('', CONTEXT)).toBe('my-photo')
  })

  it('falls back to originalName when template is only whitespace', () => {
    expect(resolveItemName('   ', CONTEXT)).toBe('my-photo')
  })

  it('leaves unknown tokens as literal text', () => {
    const result = resolveItemName('{unknown}', CONTEXT)
    expect(result).toBe('{unknown}')
  })

  it('replaces all occurrences of the same token', () => {
    const result = resolveItemName('{originalName}-{originalName}', CONTEXT)
    expect(result).toBe('my-photo-my-photo')
  })
})
