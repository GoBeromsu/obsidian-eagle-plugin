import { describe, expect, it } from 'vitest'

import {
  filePathToFileUrl,
  normalizeEagleApiPathToFileUrl,
  resolveEagleThumbnailUrl,
} from '../src/utils/file-url'

describe(filePathToFileUrl, () => {
  it('percent-encodes spaces, unicode, and parentheses', () => {
    const url = filePathToFileUrl('/Users/me/images/ID.info/우리가 (PFD).jpg')
    expect(url).toBe(
      'file:///Users/me/images/ID.info/%EC%9A%B0%EB%A6%AC%EA%B0%80%20%28PFD%29.jpg',
    )
  })

  it('handles Windows drive paths and backslashes', () => {
    const url = filePathToFileUrl('C:\\Users\\me\\Pictures\\L2 - Sound (1).jpg')
    expect(url).toBe('file:///C:/Users/me/Pictures/L2%20-%20Sound%20%281%29.jpg')
  })

  it('handles UNC paths', () => {
    const url = filePathToFileUrl('\\\\Server\\\\Share\\\\Folder\\\\Image (1).png')
    expect(url).toBe('file://Server/Share/Folder/Image%20%281%29.png')
  })
})

describe(normalizeEagleApiPathToFileUrl, () => {
  it('decodes percent-encoded Eagle api path without double-encoding', () => {
    const url = normalizeEagleApiPathToFileUrl('/Users/me/images/%EC%A7%80%ED%98%9C%EB%9E%80.jpg')
    expect(url).toBe('file:///Users/me/images/%EC%A7%80%ED%98%9C%EB%9E%80.jpg')
  })

  it('handles double-encoded Eagle api path', () => {
    const url = normalizeEagleApiPathToFileUrl(
      '/Users/me/images/%25EC%25A7%2580%25ED%2598%259C%25EB%259E%2580.jpg',
    )
    expect(url).toBe('file:///Users/me/images/%EC%A7%80%ED%98%9C%EB%9E%80.jpg')
  })

  it('normalizes file:// prefixed response path', () => {
    const url = normalizeEagleApiPathToFileUrl(
      'file:///Users/me/images/2024/01/%EC%A7%80%ED%98%9C%EB%9E%80(01).jpg',
    )
    expect(url).toBe('file:///Users/me/images/2024/01/%EC%A7%80%ED%98%9C%EB%9E%80%2801%29.jpg')
  })

  it('does not fail on malformed percent path and still returns a safe file URL', () => {
    const url = normalizeEagleApiPathToFileUrl('/Users/me/images/%E0%A4')
    expect(url).toBe('file:///Users/me/images/%25E0%25A4')
  })
})

describe(resolveEagleThumbnailUrl.name, () => {
  it('resolves api-relative thumbnail path against eagle host and port', () => {
    const url = resolveEagleThumbnailUrl('/api/item/thumbnail?id=abc', 'localhost', 41595)
    expect(url).toBe('http://localhost:41595/api/item/thumbnail?id=abc')
  })

  it('keeps absolute http url as-is', () => {
    const url = resolveEagleThumbnailUrl('https://example.com/thumb.jpg', 'localhost', 41595)
    expect(url).toBe('https://example.com/thumb.jpg')
  })

  it('normalizes local file path into file:// url', () => {
    const url = resolveEagleThumbnailUrl('/Users/me/images/IMG (1).jpg', 'localhost', 41595)
    expect(url).toBe('file:///Users/me/images/IMG%20%281%29.jpg')
  })
})
