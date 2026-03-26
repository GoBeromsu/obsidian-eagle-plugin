import { describe, expect, it, vi } from 'vitest'

import EagleHashStore from '../src/ui/EagleHashStore'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal Plugin mock that satisfies load/save. */
function createPluginMock(initialData: Record<string, unknown> = {}) {
  let store = { ...initialData }
  return {
    loadData: vi.fn(() => Promise.resolve({ ...store })),
    saveData: vi.fn((data: Record<string, unknown>) => {
      store = { ...data }
      return Promise.resolve()
    }),
    _getStore: () => store,
  }
}

/** Create an ArrayBuffer from a UTF-8 string — useful for deterministic test inputs. */
function bufferFrom(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EagleHashStore', () => {
  describe('computeHash()', () => {
    it('returns a 64-character hex string for a non-empty buffer', async () => {
      const hash = await EagleHashStore.computeHash(bufferFrom('hello'))
      expect(hash).toMatch(/^[0-9a-f]{64}$/)
    })

    it('produces consistent output for the same input', async () => {
      const a = await EagleHashStore.computeHash(bufferFrom('consistent'))
      const b = await EagleHashStore.computeHash(bufferFrom('consistent'))
      expect(a).toBe(b)
    })

    it('produces different hashes for different inputs', async () => {
      const a = await EagleHashStore.computeHash(bufferFrom('foo'))
      const b = await EagleHashStore.computeHash(bufferFrom('bar'))
      expect(a).not.toBe(b)
    })

    it('is the correct SHA-256 for a known input', async () => {
      // SHA-256('hello') = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
      const hash = await EagleHashStore.computeHash(bufferFrom('hello'))
      expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
    })
  })

  describe('lookup()', () => {
    it('returns null when the store is empty', () => {
      const store = new EagleHashStore()
      expect(store.lookup('abc123', '/path/to/library')).toBeNull()
    })

    it('returns null when hash does not exist', () => {
      const store = new EagleHashStore()
      store.store('known-hash', 'item-1', 'screenshot', '/lib')
      expect(store.lookup('unknown-hash', '/lib')).toBeNull()
    })

    it('returns the itemId and displayName when hash and libraryPath both match', () => {
      const store = new EagleHashStore()
      store.store('hash-abc', 'item-42', 'my-image', '/my/library')
      expect(store.lookup('hash-abc', '/my/library')).toEqual({ itemId: 'item-42', displayName: 'my-image' })
    })

    it('returns null when hash matches but libraryPath differs', () => {
      const store = new EagleHashStore()
      store.store('hash-abc', 'item-42', 'photo', '/library-a')
      expect(store.lookup('hash-abc', '/library-b')).toBeNull()
    })

    it('returns empty string for displayName when stored with empty displayName', () => {
      const store = new EagleHashStore()
      store.store('hash-x', 'item-1', '', '/lib')
      expect(store.lookup('hash-x', '/lib')).toEqual({ itemId: 'item-1', displayName: '' })
    })
  })

  describe('store() + lookup() round-trip', () => {
    it('stores and retrieves multiple entries independently', () => {
      const store = new EagleHashStore()
      store.store('hash-1', 'item-1', 'img-a', '/lib')
      store.store('hash-2', 'item-2', 'img-b', '/lib')

      expect(store.lookup('hash-1', '/lib')).toEqual({ itemId: 'item-1', displayName: 'img-a' })
      expect(store.lookup('hash-2', '/lib')).toEqual({ itemId: 'item-2', displayName: 'img-b' })
    })

    it('overwrites an existing entry when the same hash is stored again', () => {
      const store = new EagleHashStore()
      store.store('hash-x', 'old-item', 'old-name', '/lib')
      store.store('hash-x', 'new-item', 'new-name', '/lib')

      expect(store.lookup('hash-x', '/lib')).toEqual({ itemId: 'new-item', displayName: 'new-name' })
    })
  })

  describe('evict()', () => {
    it('removes the entry so lookup returns null afterwards', () => {
      const store = new EagleHashStore()
      store.store('hash-evict', 'item-evict', 'evict-img', '/lib')
      store.evict('hash-evict')
      expect(store.lookup('hash-evict', '/lib')).toBeNull()
    })

    it('is a no-op for a non-existent hash', () => {
      const store = new EagleHashStore()
      // Should not throw
      expect(() => store.evict('no-such-hash')).not.toThrow()
    })
  })

  describe('pruneOldEntries()', () => {
    it('removes entries older than maxAgeDays', () => {
      const store = new EagleHashStore()

      // Inject a stale entry by manipulating internal data via store() then
      // patching uploadedAt via the internal data reference.
      store.store('old-hash', 'old-item', 'old-img', '/lib')

      // Access private data — acceptable in unit tests to set precise timestamps
      const data = (store as unknown as { data: { entries: Record<string, { uploadedAt: number }> } }).data
      data.entries['old-hash'].uploadedAt = Date.now() - 100 * 24 * 60 * 60 * 1000 // 100 days ago

      store.pruneOldEntries(90)
      expect(store.lookup('old-hash', '/lib')).toBeNull()
    })

    it('keeps entries newer than maxAgeDays', () => {
      const store = new EagleHashStore()
      store.store('recent-hash', 'recent-item', 'recent-img', '/lib')

      // Ensure the entry is only 1 day old
      const data = (store as unknown as { data: { entries: Record<string, { uploadedAt: number }> } }).data
      data.entries['recent-hash'].uploadedAt = Date.now() - 1 * 24 * 60 * 60 * 1000

      store.pruneOldEntries(90)
      expect(store.lookup('recent-hash', '/lib')).toEqual({ itemId: 'recent-item', displayName: 'recent-img' })
    })

    it('removes only expired entries when the store has a mix', () => {
      const store = new EagleHashStore()
      store.store('old', 'old-item', 'old-img', '/lib')
      store.store('new', 'new-item', 'new-img', '/lib')

      const data = (store as unknown as { data: { entries: Record<string, { uploadedAt: number }> } }).data
      data.entries['old'].uploadedAt = Date.now() - 200 * 24 * 60 * 60 * 1000

      store.pruneOldEntries(90)
      expect(store.lookup('old', '/lib')).toBeNull()
      expect(store.lookup('new', '/lib')).toEqual({ itemId: 'new-item', displayName: 'new-img' })
    })
  })

  describe('load() + save()', () => {
    it('persists entries across save/load cycle', async () => {
      const plugin = createPluginMock()

      const storeA = new EagleHashStore()
      await storeA.load(plugin as any)
      storeA.store('persist-hash', 'persist-item', 'persist-img', '/lib')
      await storeA.save(plugin as any)

      const storeB = new EagleHashStore()
      await storeB.load(plugin as any)
      expect(storeB.lookup('persist-hash', '/lib')).toEqual({ itemId: 'persist-item', displayName: 'persist-img' })
    })

    it('starts empty when no prior data exists', async () => {
      const plugin = createPluginMock()
      const store = new EagleHashStore()
      await store.load(plugin as any)
      expect(store.lookup('any', '/lib')).toBeNull()
    })

    it('does not overwrite unrelated plugin data on save', async () => {
      const plugin = createPluginMock({ otherKey: 'should-survive' })

      const store = new EagleHashStore()
      await store.load(plugin as any)
      store.store('h', 'item', 'img', '/lib')
      await store.save(plugin as any)

      const saved = plugin._getStore()
      expect(saved['otherKey']).toBe('should-survive')
    })

    it('handles corrupt stored data gracefully and starts empty', async () => {
      const plugin = createPluginMock({ 'eagle-hash-store': 'not-an-object' })
      const store = new EagleHashStore()
      await store.load(plugin as any)
      // Should not throw and should behave as a fresh store
      expect(store.lookup('any', '/lib')).toBeNull()
    })

    it('gracefully handles old-format entries missing displayName field', async () => {
      // Simulate data written by an older version of the plugin that had no displayName.
      const oldFormatData = {
        'eagle-hash-store': {
          version: 1,
          entries: {
            'legacy-hash': { itemId: 'legacy-item', libraryPath: '/lib', uploadedAt: Date.now() },
          },
        },
      }
      const plugin = createPluginMock(oldFormatData)
      const store = new EagleHashStore()
      await store.load(plugin as any)
      // Should return the entry with an empty displayName (not crash)
      expect(store.lookup('legacy-hash', '/lib')).toEqual({ itemId: 'legacy-item', displayName: '' })
    })
  })
})
