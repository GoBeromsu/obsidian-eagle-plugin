import { beforeEach, describe, expect, it } from 'vitest'

import { DEFAULT_SETTINGS } from '../src/plugin-settings'
import EagleUploader from '../src/uploader/EagleUploader'
import { __resetRequestUrlMock, __setRequestUrlMock } from './mocks/obsidian'

function successResponse(data: unknown) {
  return {
    status: 200,
    statusText: 'OK',
    json: {
      status: 'success',
      data,
    },
    text: '',
  }
}

function createUploaderForTest(): EagleUploader {
  return new EagleUploader({} as any, DEFAULT_SETTINGS)
}

describe('EagleUploader search item normalization', () => {
  beforeEach(() => {
    __resetRequestUrlMock()
  })

  it('maps thumbnail from alternative fields', async () => {
    __setRequestUrlMock(() =>
      Promise.resolve(successResponse([
        { id: 'item-1', name: 'One', thumbnailPath: '/api/item/thumbnail?id=item-1' },
        { id: 'item-2', name: 'Two', thumb: '/api/item/thumbnail?id=item-2' },
        { id: 'item-3', name: 'Three', thumbnail: '/api/item/thumbnail?id=item-3' },
      ])),
    )

    const uploader = createUploaderForTest()
    const items = await uploader.searchItems({ keyword: 'item', limit: 10 })

    expect(items).toHaveLength(3)
    expect(items[0]?.thumbnail).toBe('/api/item/thumbnail?id=item-1')
    expect(items[1]?.thumbnail).toBe('/api/item/thumbnail?id=item-2')
    expect(items[2]?.thumbnail).toBe('/api/item/thumbnail?id=item-3')
  })

  it('ignores missing or non-string thumbnail candidates', async () => {
    __setRequestUrlMock(() =>
      Promise.resolve(successResponse([
        { id: 'item-1', name: 'One' },
        { id: 'item-2', name: 'Two', thumbnail: { bad: true } },
      ])),
    )

    const uploader = createUploaderForTest()
    const items = await uploader.searchItems({ keyword: 'item', limit: 10 })

    expect(items).toHaveLength(2)
    expect(items[0]?.thumbnail).toBeUndefined()
    expect(items[1]?.thumbnail).toBeUndefined()
  })

  it('filters out invalid item ids', async () => {
    __setRequestUrlMock(() =>
      Promise.resolve(successResponse([
        { id: 123, name: 'invalid' },
        { id: 'item-1', name: 'valid' },
      ])),
    )

    const uploader = createUploaderForTest()
    const items = await uploader.searchItems({ keyword: 'item', limit: 10 })

    expect(items).toHaveLength(1)
    expect(items[0]?.id).toBe('item-1')
  })
})
