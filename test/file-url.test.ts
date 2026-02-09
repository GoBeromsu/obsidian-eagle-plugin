import { describe, expect, it } from 'vitest'

import { filePathToFileUrl } from '../src/utils/file-url'

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

