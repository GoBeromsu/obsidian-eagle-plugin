import { App } from 'obsidian'

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

    let fileCount = 0
    let totalSizeBytes = 0

    try {
      const listed = await adapter.list(this.cacheFolder)
      await Promise.allSettled(
        listed.files.map(async (filePath) => {
          const stat = await adapter.stat(filePath)
          if (stat) {
            fileCount++
            totalSizeBytes += stat.size
          }
        }),
      )
    } catch {
      // Cache folder unreadable — return what we have so far
    }

    return { fileCount, totalSizeBytes }
  }

  async cacheFromBuffer(itemId: string, ext: string, data: ArrayBuffer): Promise<void> {
    await this.ensureCacheFolder()
    await this.app.vault.adapter.writeBinary(this.cachedVaultPath(itemId, ext), data)
  }

  async cacheFromOsPath(itemId: string, ext: string, absolutePath: string): Promise<void> {
    await this.ensureCacheFolder()
    const adapter = this.app.vault.adapter as any
    const data = await new Promise<ArrayBuffer>((resolve, reject) => {
      adapter.fs.readFile(absolutePath, (err: any, buffer: Buffer) => {
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
