import { App } from 'obsidian'

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

  async ensureCacheFolder(): Promise<void> {
    if (this.ensureFolderPromise === null) {
      this.ensureFolderPromise = (async () => {
        const { adapter } = this.app.vault
        if (!(await adapter.exists(this.cacheFolder))) {
          await adapter.mkdir(this.cacheFolder)
        }
      })().catch((err) => {
        this.ensureFolderPromise = null // allow retry on next call
        throw err
      })
    }
    return this.ensureFolderPromise
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
