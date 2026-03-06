import { describe, expect, it } from 'vitest'

import {
  detectImageFormat,
  isLikelyImageFile,
} from '../src/utils/image-format'
import { normalizeImageForUpload } from '../src/utils/misc'

function bytesToArrayBuffer(bytes: number[]) {
  return new Uint8Array(bytes).buffer
}

describe(detectImageFormat, () => {
  it('detects png by signature', () => {
    const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    const result = detectImageFormat(bytesToArrayBuffer(pngSignature), 'image.bin')
    expect(result.extension).toBe('png')
    expect(result.mimeType).toBe('image/png')
    expect(result.source).toBe('signature')
    expect(result.renderable).toBe(true)
  })

  it('detects jpeg by signature', () => {
    const jpegSignature = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]
    const result = detectImageFormat(bytesToArrayBuffer(jpegSignature), 'image.bin')
    expect(result.extension).toBe('jpg')
    expect(result.mimeType).toBe('image/jpeg')
    expect(result.renderable).toBe(true)
  })

  it('detects heic by ftyp brand', () => {
    const heicSignature = [
      0x00,
      0x00,
      0x00,
      0x18,
      0x66,
      0x74,
      0x79,
      0x70,
      0x68,
      0x65,
      0x69,
      0x63,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
    ]
    const result = detectImageFormat(bytesToArrayBuffer(heicSignature), 'image.heic')
    expect(result.extension).toBe('heic')
    expect(result.mimeType).toBe('image/heic')
    expect(result.renderable).toBe(false)
    expect(result.source).toBe('signature')
  })

  it('falls back to extension when signature missing', () => {
    const result = detectImageFormat(new ArrayBuffer(0), 'picture.heic', 'application/octet-stream')
    expect(result.extension).toBe('heic')
    expect(result.renderable).toBe(false)
    expect(result.source).toBe('extension')
  })
})

describe(isLikelyImageFile, () => {
  it('recognizes image MIME and extension', () => {
    expect(isLikelyImageFile({ type: 'image/heic', name: 'capture.bin' })).toBe(true)
    expect(isLikelyImageFile({ type: '', name: 'photo.heic' })).toBe(true)
    expect(isLikelyImageFile({ type: '', name: 'photo.txt' })).toBe(false)
  })
})

describe('normalizeImageForUpload', () => {
  it('passes non-renderable files through as-is (Eagle handles natively)', async () => {
    const heicSignature = [
      0x00,
      0x00,
      0x00,
      0x18,
      0x66,
      0x74,
      0x79,
      0x70,
      0x68,
      0x65,
      0x69,
      0x63,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
    ]
    const file = new File([new Uint8Array(heicSignature)], 'photo.heic', {
      type: 'image/heic',
    })
    const result = await normalizeImageForUpload(file)
    expect(result.name).toBe('photo.heic')
    expect(result.type).toBe('image/heic')
  })

  it('passes completely unrecognized files through unchanged', async () => {
    const file = new File([new Uint8Array([0xde, 0xad, 0xbe, 0xef])], 'data.bin', { type: '' })
    const result = await normalizeImageForUpload(file)
    expect(result.name).toBe('data.bin')
    expect(result.type).toBe('')
  })

  it('keeps renderable files with valid signatures', async () => {
    const pngSignature = [
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a,
      0x00,
      0x00,
      0x00,
      0x0d,
      0x49,
      0x48,
      0x44,
      0x52,
    ]
    const file = new File([new Uint8Array(pngSignature)], 'existing.png', {
      type: 'image/png',
    })
    const normalized = await normalizeImageForUpload(file)
    expect(normalized.type).toBe('image/png')
    expect(normalized.name).toBe('existing.png')
  })
})
