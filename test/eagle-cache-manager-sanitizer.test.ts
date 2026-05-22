import { describe, expect, it, vi } from 'vitest'

import EagleCacheManager from '../src/ui/EagleCacheManager'

function createAppMock() {
  return {
    vault: {
      adapter: {
        exists: vi.fn().mockResolvedValue(false),
        mkdir: vi.fn().mockResolvedValue(undefined),
        writeBinary: vi.fn().mockResolvedValue(undefined),
      },
    },
  }
}

describe('EagleCacheManager path contract', () => {
  it('sanitizes cache folder, item id, display name, and extension for writes', async () => {
    const app = createAppMock()
    const manager = new EagleCacheManager(app as any, '../cache\\nested')

    expect(manager.cacheFolder).toBe('cache/nested')
    expect(manager.cachedVaultPath('../id', 'bad/ext', '[[name]]|x')).toMatch(
      /^cache\/nested\/name-x_id-[a-z0-9]+\.jpg$/,
    )

    await manager.cacheFromBuffer('../id', 'bad/ext', new ArrayBuffer(1), '[[name]]|x')
    expect(app.vault.adapter.mkdir).toHaveBeenCalledWith('cache')
    expect(app.vault.adapter.mkdir).toHaveBeenCalledWith('cache/nested')
    expect(app.vault.adapter.writeBinary.mock.calls[0][0]).toMatch(
      /^cache\/nested\/name-x_id-[a-z0-9]+\.jpg$/,
    )
  })
})
