import { describe, expect, it } from 'vitest'

import {
  cacheFileNameFor,
  cachePathFor,
  dedupePathSegments,
  safeCacheFolderPath,
  safeCacheFolderSegment,
  safeDisplayName,
  safeImageExtension,
  safeItemId,
  safePathSegment,
  safeWikilinkText,
  wikilinkForCacheItem,
} from '../src/utils/eagle-path-contract'

describe('Eagle path sanitizer contract', () => {
  it('prevents display names from creating paths or wikilink syntax', () => {
    expect(safeDisplayName('foo/bar\\baz')).toBe('foo-bar-baz')
    expect(safeDisplayName('[[bad]]|alias')).toBe('bad-alias')
    expect(safeDisplayName('bad\u0000name\n')).toBe('badname')
  })

  it('sanitizes item ids with stable suffixes when unsafe characters are removed', () => {
    expect(safeItemId('abc123')).toBe('abc123')
    expect(safeItemId('../abc')).toMatch(/^abc-[a-z0-9]+$/)
    expect(safeItemId('a/b')).not.toBe(safeItemId('a\\b'))
  })

  it('normalizes cache folder segments and paths without traversal', () => {
    expect(safeCacheFolderSegment('..')).toBe('eagle-cache')
    expect(safeCacheFolderPath('../safe/..//folder\\child')).toBe('safe/folder/child')
    expect(safeCacheFolderPath('')).toBe('eagle-cache')
  })

  it('normalizes path segments and deterministic collisions', () => {
    expect(safePathSegment('a/b')).toMatch(/^a-b-[a-z0-9]+$/)
    expect(dedupePathSegments(['same', 'same', 'a/b', 'a/b'])).toEqual([
      'same',
      'same-2',
      safePathSegment('a/b'),
      `${safePathSegment('a/b')}-2`,
    ])
  })

  it('allows only safe image extensions', () => {
    expect(safeImageExtension('PNG')).toBe('png')
    expect(safeImageExtension('.jpeg')).toBe('jpeg')
    expect(safeImageExtension('../svg')).toBe('jpg')
    expect(safeImageExtension('html')).toBe('jpg')
    expect(safeImageExtension('')).toBe('jpg')
  })

  it('builds safe cache filenames, paths, and wikilinks', () => {
    const fileName = cacheFileNameFor('../id', 'bad/ext', '[[x/y]]|z')
    expect(fileName).toMatch(/^x-y-z_id-[a-z0-9]+\.jpg$/)

    const path = cachePathFor('../cache', '../id', 'png', 'a/b')
    expect(path).toMatch(/^cache\/a-b_id-[a-z0-9]+\.png$/)

    const link = wikilinkForCacheItem('cache', 'id', 'png', 'bad[[name]]|alias')
    expect(link).toBe('![[cache/bad-name-alias_id.png]]')
  })

  it('provides deterministic fallbacks for empty names and wikilink text', () => {
    expect(safeDisplayName('')).toBe('image')
    expect(safeItemId('')).toBe('item')
    expect(safeWikilinkText('[[|]]')).toBe('image')
  })
})
