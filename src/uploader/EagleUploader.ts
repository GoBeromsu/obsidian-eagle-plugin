import { tmpdir } from 'os'

import { App, requestUrl } from 'obsidian'

import { EaglePluginSettings } from '../plugin-settings'
import { normalizeEagleApiPathToFileUrl, resolveEagleThumbnailUrl } from '../utils/file-url'
import { extractFileExtension } from '../utils/image-format'
import { generatePseudoRandomId } from '../utils/pseudo-random'
import EagleApiError from './EagleApiError'

const EAGLE_API_ENDPOINTS = {
  ADD_FROM_PATH: '/api/item/addFromPath',
  THUMBNAIL: '/api/item/thumbnail',
  FOLDER_LIST: '/api/folder/list',
  FOLDER_CREATE: '/api/folder/create',
  ITEM_LIST: '/api/item/list',
  ITEM_INFO: '/api/item/info',
  LIBRARY_INFO: '/api/library/info',
} as const

const EAGLE_PROCESSING_DELAY_MS = 300
const EAGLE_URL_PROTOCOL = 'eagle://item/'
const CONNECTION_ERROR_HINT =
  'Cannot connect to Eagle. Make sure Eagle is running and API host/port are correct.'

interface EagleFolder {
  id: string
  name: string
  children?: EagleFolder[]
}

export interface EagleFolderWithPath {
  id: string
  name: string
  /** Slash-separated full path from the library root (e.g. "Resources/Obsidian"). Equal to `name` for root-level folders. No leading or trailing slash. */
  path: string
}

export interface EagleItemSearchOptions {
  keyword: string
  limit?: number
  orderBy?: string
  offset?: number
}

export interface EagleItemSearchResult {
  id: string
  name: string
  ext?: string
  tags?: string[]
  annotation?: string
  isDeleted?: boolean
  filePath?: string
  thumbnail?: string
}

export interface EagleUploadResult {
  itemId: string
  fileUrl: string
  ext: string
}

export interface EagleUploadOptions {
  folderName?: string
  signal?: AbortSignal
}

interface EagleListResponse {
  status?: string
  message?: string
  data?: unknown
}

interface EagleRawItemCandidate extends Partial<EagleItemSearchResult> {
  id?: string
  name?: string
  ext?: string
  tags?: string | string[]
  annotation?: string
  isDeleted?: boolean
  filePath?: string
  thumbnail?: string
  thumb?: string
  thumbnailPath?: string
  preview?: string
  previewPath?: string
}

export default class EagleUploader {
  private readonly app: App
  private readonly settings: EaglePluginSettings
  private folderIdCache: Map<string, string> = new Map<string, string>()
  private folderIdInFlight: Map<string, Promise<string>> = new Map<string, Promise<string>>()
  private readonly fileUrlCache = new Map<string, string>()
  private readonly fileUrlInFlight = new Map<string, Promise<string>>()

  constructor(app: App, settings: EaglePluginSettings) {
    this.app = app
    this.settings = settings
  }

  private async requestJson<T>(url: string, method: 'GET' | 'POST', body?: string, signal?: AbortSignal): Promise<T> {
    try {
      if (signal?.aborted) throw new DOMException('Upload cancelled', 'AbortError')

      const headers = method === 'POST'
        ? { 'Content-Type': 'application/json' }
        : undefined

      const resp = await requestUrl({
        url,
        method,
        headers,
        body,
        throw: false,
      })

      if (signal?.aborted) throw new DOMException('Upload cancelled', 'AbortError')

      if (resp.status < 200 || resp.status >= 300) {
        const responseMessage = this.extractResponseMessage(resp.json)
          || this.extractTextMessage(resp)
          || `${resp.status} ${resp.statusText || 'Unknown Error'}`
        throw new EagleApiError(responseMessage)
      }

      return resp.json as T
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error
      }
      if (error instanceof EagleApiError) {
        throw error
      }

      const message = this.normalizeRequestError(error)
      throw new EagleApiError(`${CONNECTION_ERROR_HINT} ${message}`)
    }
  }

  private extractTextMessage(resp: { text?: unknown }): string {
    if (typeof resp.text === 'string' && resp.text.trim()) {
      return resp.text.trim()
    }
    return ''
  }

  private extractResponseMessage(payload: unknown): string {
    if (!payload || typeof payload !== 'object') return ''
    if ('message' in payload && typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message.trim()
    }
    return ''
  }

  private normalizeRequestError(error: unknown): string {
    let rawMessage = ''
    if (error instanceof Error) {
      rawMessage = error.message
    } else if (typeof error === 'string') {
      rawMessage = error
    }
    return rawMessage ? `(${rawMessage})` : ''
  }

  async upload(image: File, options?: EagleUploadOptions): Promise<EagleUploadResult> {
    const signal = options?.signal
    const tempFilePath = await this.saveToTempFile(image)

    try {
      const targetFolderName = options?.folderName?.trim() || this.settings.eagleFolderName.trim()

      let folderId: string | undefined
      if (targetFolderName) {
        folderId = await this.ensureFolderExists(targetFolderName, signal)
      }

      const itemId = await this.addToEagle(tempFilePath, folderId, signal)

      if (signal?.aborted) throw new DOMException('Upload cancelled', 'AbortError')

      await new Promise<void>((resolve, reject) => {
        const onAbort = () => {
          clearTimeout(timer)
          reject(new DOMException('Upload cancelled', 'AbortError'))
        }
        const timer = setTimeout(() => {
          signal?.removeEventListener('abort', onAbort)
          resolve()
        }, EAGLE_PROCESSING_DELAY_MS)
        signal?.addEventListener('abort', onAbort, { once: true })
      })

      const fileUrl = await this.getFileUrlForItemId(itemId, signal)
      const extFromUrl = fileUrl.startsWith('file://') ? extractFileExtension(fileUrl) : ''
      const ext = extFromUrl || extractFileExtension(image.name) || 'jpg'
      return { itemId, fileUrl, ext }
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const fs = (this.app.vault?.adapter as any)?.fs
      if (fs?.unlink) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        fs.unlink(tempFilePath, (err: NodeJS.ErrnoException | null) => {
          if (err && err.code !== 'ENOENT') {
            console.warn('Eagle: failed to delete temp file', { tempFilePath, code: err.code, message: err.message })
          }
        })
      }
    }
  }

  private async saveToTempFile(image: File): Promise<string> {
    const tempFileName = `eagle-temp-${generatePseudoRandomId()}.${image.name.split('.').pop()}`
    const adapter = this.app.vault.adapter as any
    const osTempDir = tmpdir()
    const tempFilePath = adapter.path.join(osTempDir, tempFileName)
    const arrayBuffer = await image.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    return new Promise((resolve, reject) => {
      adapter.fs.writeFile(tempFilePath, buffer, (err: any) => {
        if (err) {
          reject(err instanceof Error ? err : new Error(String(err)))
          return
        }
        resolve(tempFilePath)
      })
    })
  }

  private async addToEagle(filePath: string, folderId: string | undefined, signal?: AbortSignal): Promise<string> {
    const { eagleHost, eaglePort } = this.settings
    const url = `http://${eagleHost}:${eaglePort}${EAGLE_API_ENDPOINTS.ADD_FROM_PATH}`

    const body: Record<string, string> = {
      path: filePath,
      name: filePath.split('/').pop() || 'image',
      annotation: 'Added via Obsidian Eagle Plugin',
    }

    if (folderId) {
      body.folderId = folderId
    }

    const data = await this.requestJson<EagleListResponse>(url, 'POST', JSON.stringify(body), signal)

    if (data?.status !== 'success') {
      const errorMsg = data?.message || 'Unknown error'
      throw new EagleApiError(errorMsg)
    }

    if (typeof data?.data !== 'string') {
      throw new EagleApiError('Eagle API returned invalid upload response')
    }

    return data.data
  }

  /**
   * Resolve a renderable file:// URL for an Eagle item.
   *
   * Search results already contain `filePath`; use it directly to avoid an
   * extra thumbnail API call.  Falls back to the thumbnail API only when
   * `filePath` is absent (e.g. for update-paths flow where only the itemId is
   * known).
   */
  async resolveFileUrl(item: EagleItemSearchResult): Promise<string> {
    if (item.filePath) {
      return normalizeEagleApiPathToFileUrl(item.filePath)
    }
    return this.getFileUrlForItemId(item.id)
  }

  resolveSearchThumbnailUrl(rawThumbnail: string): string {
    const { eagleHost, eaglePort } = this.settings
    return resolveEagleThumbnailUrl(rawThumbnail, eagleHost, eaglePort)
  }

  async getFileUrlForItemId(itemId: string, signal?: AbortSignal): Promise<string> {
    const cached = this.fileUrlCache.get(itemId)
    if (cached) return cached

    const inFlight = this.fileUrlInFlight.get(itemId)
    if (inFlight !== undefined) return inFlight

    const promise = this.fetchFileUrlForItemId(itemId, signal)
      .then((url) => {
        if (url.startsWith('file://')) {
          this.fileUrlCache.set(itemId, url)
        }
        return url
      })
      .finally(() => {
        this.fileUrlInFlight.delete(itemId)
      })

    this.fileUrlInFlight.set(itemId, promise)
    return promise
  }

  // Use item info to get exact name + extension.
  // The thumbnail endpoint always returns .png thumbnails regardless of the original
  // file format, so deriving the original path from the thumbnail path gives the wrong
  // extension for non-PNG originals (e.g. .jpg files would resolve as .png).
  private async fetchFileUrlForItemId(itemId: string, signal?: AbortSignal): Promise<string> {
    const { eagleHost, eaglePort } = this.settings
    const infoUrl = `http://${eagleHost}:${eaglePort}${EAGLE_API_ENDPOINTS.ITEM_INFO}?id=${itemId}`
    const infoData = await this.requestJson<{ status: string; data?: { name?: string; ext?: string } }>(infoUrl, 'GET', undefined, signal)

    if (infoData?.status !== 'success') {
      console.warn('Eagle: item/info returned non-success', { itemId, status: infoData?.status })
    } else if (!infoData.data?.name || !infoData.data?.ext) {
      console.warn('Eagle: item/info response missing name/ext', { itemId, data: infoData.data })
    } else {
      const { name, ext } = infoData.data
      const libraryRoot = await this.getLibraryRootPath(signal)
      if (!libraryRoot) {
        console.warn('Eagle: cannot resolve library root — falling back to eagle:// URL', { itemId })
      } else {
        const filePath = `${libraryRoot}/images/${itemId}.info/${name}.${ext}`
        return normalizeEagleApiPathToFileUrl(filePath)
      }
    }

    return `${EAGLE_URL_PROTOCOL}${itemId}`
  }

  async getLibraryRootPath(signal?: AbortSignal): Promise<string | null> {
    const { eagleHost, eaglePort } = this.settings
    const url = `http://${eagleHost}:${eaglePort}${EAGLE_API_ENDPOINTS.LIBRARY_INFO}`
    const data = await this.requestJson<{ status: string; data?: { library?: { path?: string } } }>(url, 'GET', undefined, signal)
    return data?.data?.library?.path ?? null
  }

  /**
   * Returns a file:// URL pointing to the Eagle-generated thumbnail image.
   * Used for displaying preview images in the picker modal without extra processing.
   */
  async getThumbnailFileUrl(itemId: string): Promise<string> {
    const { eagleHost, eaglePort } = this.settings
    const url = `http://${eagleHost}:${eaglePort}${EAGLE_API_ENDPOINTS.THUMBNAIL}?id=${itemId}`

    const data = await this.requestJson<EagleListResponse>(url, 'GET')

    if (data?.status === 'success' && typeof data?.data === 'string') {
      return normalizeEagleApiPathToFileUrl(data.data)
    }

    throw new EagleApiError(`Cannot load thumbnail for item ${itemId}`)
  }

  private async listFoldersRaw(signal?: AbortSignal): Promise<EagleFolder[]> {
    const { eagleHost, eaglePort } = this.settings
    const url = `http://${eagleHost}:${eaglePort}${EAGLE_API_ENDPOINTS.FOLDER_LIST}`

    const data = await this.requestJson<EagleListResponse>(url, 'GET', undefined, signal)

    if (data?.status === 'success' && Array.isArray(data?.data)) {
      return this.parseFolderList(data.data)
    }

    throw new EagleApiError('Failed to list folders')
  }

  private parseFolderList(raw: unknown[]): EagleFolder[] {
    return raw.map((folder) => {
      if (!folder || typeof folder !== 'object') {
        throw new EagleApiError('Eagle API returned invalid folder list payload')
      }

      const typedFolder = folder as { id?: unknown; name?: unknown; children?: unknown }
      if (typeof typedFolder.id !== 'string' || typeof typedFolder.name !== 'string') {
        throw new EagleApiError('Eagle API returned invalid folder payload')
      }

      return {
        id: typedFolder.id,
        name: typedFolder.name,
        children: Array.isArray(typedFolder.children)
          ? this.parseFolderList(typedFolder.children)
          : undefined,
      }
    })
  }

  private flattenFolderTree(folders: EagleFolder[], parentPath = ''): EagleFolderWithPath[] {
    const result: EagleFolderWithPath[] = []
    for (const folder of folders) {
      const path = parentPath ? `${parentPath}/${folder.name}` : folder.name
      result.push({ id: folder.id, name: folder.name, path })
      if (folder.children?.length) {
        result.push(...this.flattenFolderTree(folder.children, path))
      }
    }
    return result
  }

  async createFolder(name: string, signal?: AbortSignal): Promise<string> {
    const { eagleHost, eaglePort } = this.settings
    const url = `http://${eagleHost}:${eaglePort}${EAGLE_API_ENDPOINTS.FOLDER_CREATE}`

    const data = await this.requestJson<EagleListResponse>(
      url,
      'POST',
      JSON.stringify({ folderName: name }),
      signal,
    )

    if (data?.status === 'success' && data?.data && typeof data.data === 'object') {
      const typedData = data.data as { id?: unknown }
      if (typeof typedData.id === 'string') {
        return typedData.id
      }
    }

    throw new EagleApiError('Failed to create folder')
  }

  async ensureFolderExists(name: string, signal?: AbortSignal): Promise<string> {
    const cached = this.folderIdCache.get(name)
    if (cached !== undefined) return cached

    const inFlight = this.folderIdInFlight.get(name)
    if (inFlight !== undefined) return inFlight

    const resolvePromise = this.resolveFolderId(name, signal)
      .then((folderId) => {
        this.folderIdCache.set(name, folderId)
        return folderId
      })
      .finally(() => {
        this.folderIdInFlight.delete(name)
      })

    this.folderIdInFlight.set(name, resolvePromise)
    return resolvePromise
  }

  private async resolveFolderId(name: string, signal?: AbortSignal): Promise<string> {
    const rawFolders = await this.listFoldersRaw(signal)
    const flat = this.flattenFolderTree(rawFolders)

    // Match strategy:
    // 1. Full path — slash-separated input like "Resources/Obsidian" maps to a truly nested folder.
    // 2. Root name — simple input like "Obsidian" maps to a top-level folder (no parent).
    // Falls through to create a new root-level folder if neither matches.
    const byPath = flat.find((f) => f.path === name)
    if (byPath) return byPath.id

    const byName = flat.find((f) => f.name === name && !f.path.includes('/'))
    if (byName) return byName.id

    if (name.includes('/')) {
      console.warn('Eagle: nested folder path not found in library; creating root folder with literal name', { name })
    }
    return this.createFolder(name, signal)
  }

  async listFolders(): Promise<EagleFolderWithPath[]> {
    const rawFolders = await this.listFoldersRaw()
    return this.flattenFolderTree(rawFolders)
  }

  async isConnected(): Promise<boolean> {
    try {
      await this.getLibraryRootPath()
      return true
    } catch (err) {
      console.debug('Eagle: isConnected check failed', err)
      return false
    }
  }

  /**
   * Returns `true` if the item exists and is not deleted, `false` if confirmed absent,
   * or `null` if the check failed (Eagle unreachable, network error, server error).
   * Callers must NOT evict cached files when this returns `null`.
   */
  async itemExists(itemId: string): Promise<boolean | null> {
    try {
      const { eagleHost, eaglePort } = this.settings
      const url = `http://${eagleHost}:${eaglePort}${EAGLE_API_ENDPOINTS.ITEM_INFO}?id=${itemId}`
      const data = await this.requestJson<{ status: string; data?: { isDeleted?: boolean } }>(url, 'GET')
      return data.status === 'success' && !data.data?.isDeleted
    } catch (err) {
      console.debug('Eagle: itemExists check failed — treating as uncertain', { itemId, err })
      return null
    }
  }

  private firstNonEmptyStringValue(candidate: EagleRawItemCandidate, keys: string[]): string | undefined {
    for (const key of keys) {
      const value = (candidate as Record<string, unknown>)[key]
      if (typeof value === 'string' && value.trim()) {
        return value
      }
    }
    return undefined
  }

  private extractThumbnailCandidate(candidate: EagleRawItemCandidate): string | undefined {
    return this.firstNonEmptyStringValue(candidate, [
      'thumbnail',
      'thumb',
      'thumbnailPath',
      'preview',
      'previewPath',
    ])
  }

  async searchItems({
    keyword,
    limit = 200,
    orderBy,
    offset = 0,
  }: EagleItemSearchOptions): Promise<EagleItemSearchResult[]> {
    const trimmedKeyword = keyword.trim()
    if (!trimmedKeyword) return []

    const params = new URLSearchParams({
      keyword: trimmedKeyword,
      offset: String(offset),
    })

    params.set('limit', String(limit))

    if (orderBy) {
      params.set('orderBy', orderBy)
    }

    const { eagleHost, eaglePort } = this.settings
    const url = `http://${eagleHost}:${eaglePort}${EAGLE_API_ENDPOINTS.ITEM_LIST}?${params.toString()}`

    const data = await this.requestJson<EagleListResponse>(url, 'GET')
    if (data?.status !== 'success') {
      const errorMsg = data?.message || 'Failed to search Eagle items'
      throw new EagleApiError(errorMsg)
    }

    const maybeItems = data.data
    let rawItems: unknown
    if (Array.isArray(maybeItems)) {
      rawItems = maybeItems
    } else if (maybeItems && typeof maybeItems === 'object') {
      rawItems = (maybeItems as { items?: unknown }).items || (maybeItems as { data?: unknown }).data
    } else {
      rawItems = []
    }

    if (!Array.isArray(rawItems)) {
      throw new EagleApiError('Eagle API returned invalid item list payload')
    }

    return rawItems
      .map((item) => {
        const candidate = item as EagleRawItemCandidate

        if (!candidate.id || typeof candidate.id !== 'string') {
          return null
        }

        let tags: string[] | undefined
        if (Array.isArray(candidate.tags)) {
          tags = candidate.tags.filter((tag): tag is string => typeof tag === 'string')
        } else if (typeof candidate.tags === 'string') {
          tags = candidate.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
        }

        return {
          id: candidate.id,
          name: candidate.name || candidate.id,
          ext: candidate.ext,
          tags,
          annotation: candidate.annotation,
          isDeleted: candidate.isDeleted,
          filePath: candidate.filePath,
          thumbnail: this.extractThumbnailCandidate(candidate),
        }
      })
      .filter((item): item is EagleItemSearchResult => item !== null)
  }
}
