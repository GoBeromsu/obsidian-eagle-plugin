import { App } from 'obsidian'

import type { NodeDataAdapter } from '../types/obsidian'

export interface CacheStats {
  fileCount: number
  totalSizeBytes: number
}

export default class EagleCacheManager {
  readonly cacheFolder: string
  private readonly app: App
  // Singleton promise so concurrent callers all await the same mkdir operation.
  private ensureFolderPromise: Promise<void> | null = null

  constructor(app: App, cacheFolder: string) {
    this.app = app
    this.cacheFolder = cacheFolder
  }

  cachedVaultPath(itemId: string, ext: string): string {
    return `${this.cacheFolder}/${itemId}.${ext}`
  }

  async isCached(itemId: string, ext: string): Promise<boolean> {
    return this.app.vault.adapter.exists(this.cachedVaultPath(itemId, ext))
  }

  /** Removes the cached file for the given item. No-op if the file does not exist. */
  async removeCache(itemId: string, ext: string): Promise<void> {
    if (await this.isCached(itemId, ext)) {
      await this.app.vault.adapter.remove(this.cachedVaultPath(itemId, ext))
    }
  }

  async ensureCacheFolder(): Promise<void> {
    if (this.ensureFolderPromise === null) {
      this.ensureFolderPromise = (async () => {
        const { adapter } = this.app.vault
        // Create each path segment in order to support nested folders like "80. References/07. eagle"
        const parts = this.cacheFolder.split('/')
        let current = ''
        for (const part of parts) {
          current = current ? `${current}/${part}` : part
          if (!(await adapter.exists(current))) {
            await adapter.mkdir(current)
          }
        }
      })().catch((err) => {
        this.ensureFolderPromise = null // allow retry on next call
        throw err
      })
    }
    return this.ensureFolderPromise
  }

  async getCacheStats(): Promise<CacheStats> {
    const { adapter } = this.app.vault
    const exists = await adapter.exists(this.cacheFolder)
    if (!exists) return { fileCount: 0, totalSizeBytes: 0 }

    try {
      const listed = await adapter.list(this.cacheFolder)
      const results = await Promise.allSettled(listed.files.map((f) => adapter.stat(f)))
      let totalSizeBytes = 0
      let fileCount = 0
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          fileCount++
          totalSizeBytes += r.value.size
        }
      }
      return { fileCount, totalSizeBytes }
    } catch {
      return { fileCount: 0, totalSizeBytes: 0 }
    }
  }

  async cacheFromBuffer(itemId: string, ext: string, data: ArrayBuffer): Promise<void> {
    await this.ensureCacheFolder()
    await this.app.vault.adapter.writeBinary(this.cachedVaultPath(itemId, ext), data)
  }

  async cacheFromOsPath(itemId: string, ext: string, absolutePath: string): Promise<void> {
    await this.ensureCacheFolder()
    const adapter = this.app.vault.adapter as unknown as NodeDataAdapter
    const data = await new Promise<ArrayBuffer>((resolve, reject) => {
      adapter.fs.readFile(absolutePath, (err: NodeJS.ErrnoException | null, buffer: Buffer) => {
        if (err) {
          reject(err instanceof Error ? err : new Error(String(err)))
          return
        }
        resolve(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer)
      })
    })
    await this.app.vault.adapter.writeBinary(this.cachedVaultPath(itemId, ext), data)
  }
}
