import { Plugin } from 'obsidian'

interface HashEntry {
  itemId: string
  libraryPath: string
  uploadedAt: number
}

interface EagleHashStoreData {
  version: number
  entries: Record<string, HashEntry>
}

const STORE_KEY = 'eagle-hash-store'
const STORE_VERSION = 1

export default class EagleHashStore {
  private data: EagleHashStoreData = { version: STORE_VERSION, entries: {} }

  lookup(hash: string, libraryPath: string): string | null {
    const entry = this.data.entries[hash]
    if (!entry) return null
    if (entry.libraryPath !== libraryPath) return null
    return entry.itemId
  }

  store(hash: string, itemId: string, libraryPath: string): void {
    this.data.entries[hash] = { itemId, libraryPath, uploadedAt: Date.now() }
  }

  evict(hash: string): void {
    delete this.data.entries[hash]
  }

  pruneOldEntries(maxAgeDays = 90): void {
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000
    for (const [hash, entry] of Object.entries(this.data.entries)) {
      if (entry.uploadedAt < cutoff) {
        delete this.data.entries[hash]
      }
    }
  }

  async load(plugin: Plugin): Promise<void> {
    try {
      const raw = (await plugin.loadData()) as Record<string, unknown> | null
      if (raw && typeof raw === 'object' && STORE_KEY in raw) {
        const stored = raw[STORE_KEY] as EagleHashStoreData
        if (stored?.version === STORE_VERSION && stored.entries) {
          this.data = stored
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('EagleHashStore: failed to load', err)
    }
  }

  async save(plugin: Plugin): Promise<void> {
    try {
      const existing = ((await plugin.loadData()) as Record<string, unknown>) ?? {}
      await plugin.saveData({ ...existing, [STORE_KEY]: this.data })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('EagleHashStore: failed to save', err)
    }
  }

  static async computeHash(buffer: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const bytes = new Uint8Array(hashBuffer)
    let hex = ''
    for (const byte of bytes) hex += byte.toString(16).padStart(2, '0')
    return hex
  }
}
