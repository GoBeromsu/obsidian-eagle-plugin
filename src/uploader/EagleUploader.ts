import { tmpdir } from 'os'

import { App, requestUrl } from 'obsidian'

import { EaglePluginSettings } from '../plugin-settings'
import { normalizeEagleApiPathToFileUrl } from '../utils/file-url'
import { generatePseudoRandomId } from '../utils/pseudo-random'
import EagleApiError from './EagleApiError'

const EAGLE_API_ENDPOINTS = {
  ADD_FROM_PATH: '/api/item/addFromPath',
  THUMBNAIL: '/api/item/thumbnail',
  FOLDER_LIST: '/api/folder/list',
  FOLDER_CREATE: '/api/folder/create',
  ITEM_LIST: '/api/item/list',
} as const

const EAGLE_PROCESSING_DELAY_MS = 300
const EAGLE_URL_PROTOCOL = 'eagle://item/'
const THUMBNAIL_SUFFIX_PATTERN = /_thumbnail(\.[^.]+)$/
const CONNECTION_ERROR_HINT =
  'Cannot connect to Eagle. Make sure Eagle is running and API host/port are correct.'

interface EagleFolder {
  id: string
  name: string
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
}

type EagleListResponse = {
  status?: string
  message?: string
  data?: unknown
}

export default class EagleUploader {
  private readonly app: App
  private readonly settings: EaglePluginSettings
  private folderIdCache: Map<string, string> = new Map<string, string>()

  constructor(app: App, settings: EaglePluginSettings) {
    this.app = app
    this.settings = settings
  }

  private async requestJson<T>(url: string, method: 'GET' | 'POST', body?: string): Promise<T> {
    try {
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

      if (resp.status < 200 || resp.status >= 300) {
        const responseMessage = this.extractResponseMessage(resp.json)
          || this.extractTextMessage(resp)
          || `${resp.status} ${resp.statusText || 'Unknown Error'}`
        throw new EagleApiError(responseMessage)
      }

      return resp.json as T
    } catch (error) {
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
    const rawMessage = error instanceof Error ? error.message : String(error)
    return rawMessage ? `(${rawMessage})` : ''
  }

  async upload(image: File): Promise<EagleUploadResult> {
    const tempFilePath = await this.saveToTempFile(image)

    let folderId: string | undefined
    if (this.settings.eagleFolderName) {
      folderId = await this.ensureFolderExists(this.settings.eagleFolderName)
    }

    const itemId = await this.addToEagle(tempFilePath, folderId)
    await new Promise((resolve) => setTimeout(resolve, EAGLE_PROCESSING_DELAY_MS))
    const fileUrl = await this.getFileUrlForItemId(itemId)
    return { itemId, fileUrl }
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

  private async addToEagle(filePath: string, folderId: string | undefined): Promise<string> {
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

    const data = await this.requestJson<EagleListResponse>(url, 'POST', JSON.stringify(body))

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

  async getFileUrlForItemId(itemId: string): Promise<string> {
    const { eagleHost, eaglePort } = this.settings
    const url = `http://${eagleHost}:${eaglePort}${EAGLE_API_ENDPOINTS.THUMBNAIL}?id=${itemId}`

    const data = await this.requestJson<EagleListResponse>(url, 'GET')

    if (data?.status === 'success' && typeof data?.data === 'string') {
      const thumbnailPath = data.data
      const originalPath = thumbnailPath.replace(THUMBNAIL_SUFFIX_PATTERN, '$1')
      return normalizeEagleApiPathToFileUrl(originalPath)
    }

    return `${EAGLE_URL_PROTOCOL}${itemId}`
  }

  async listFolders(): Promise<EagleFolder[]> {
    const { eagleHost, eaglePort } = this.settings
    const url = `http://${eagleHost}:${eaglePort}${EAGLE_API_ENDPOINTS.FOLDER_LIST}`

    const data = await this.requestJson<EagleListResponse>(url, 'GET')

    if (data?.status === 'success' && Array.isArray(data?.data)) {
      return data.data.map((folder) => {
        if (!folder || typeof folder !== 'object') {
          throw new EagleApiError('Eagle API returned invalid folder list payload')
        }

        const typedFolder = folder as { id?: unknown; name?: unknown }
        if (typeof typedFolder.id !== 'string' || typeof typedFolder.name !== 'string') {
          throw new EagleApiError('Eagle API returned invalid folder payload')
        }

        return {
          id: typedFolder.id,
          name: typedFolder.name,
        }
      })
    }

    throw new EagleApiError('Failed to list folders')
  }

  async createFolder(name: string): Promise<string> {
    const { eagleHost, eaglePort } = this.settings
    const url = `http://${eagleHost}:${eaglePort}${EAGLE_API_ENDPOINTS.FOLDER_CREATE}`

    const data = await this.requestJson<EagleListResponse>(
      url,
      'POST',
      JSON.stringify({ folderName: name }),
    )

    if (data?.status === 'success' && data?.data && typeof data.data === 'object') {
      const typedData = data.data as { id?: unknown }
      if (typeof typedData.id === 'string') {
        return typedData.id
      }
    }

    throw new EagleApiError('Failed to create folder')
  }

  async ensureFolderExists(name: string): Promise<string> {
    const cached = this.folderIdCache.get(name)
    if (cached !== undefined) return cached

    const folders = await this.listFolders()
    const existing = folders.find((f) => f.name === name)

    if (existing) {
      this.folderIdCache.set(name, existing.id)
      return existing.id
    }

    const newId = await this.createFolder(name)
    this.folderIdCache.set(name, newId)
    return newId
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

    if (limit !== undefined) {
      params.set('limit', String(limit))
    }

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
    const rawItems = Array.isArray(maybeItems)
      ? maybeItems
      : maybeItems && typeof maybeItems === 'object'
        ? ((maybeItems as { items?: unknown }).items || (maybeItems as { data?: unknown }).data)
        : []

    if (!Array.isArray(rawItems)) {
      throw new EagleApiError('Eagle API returned invalid item list payload')
    }

    return rawItems
      .map((item) => {
        const candidate = item as Partial<EagleItemSearchResult> & {
          id?: string
          name?: string
          ext?: string
          tags?: string | string[]
          annotation?: string
          isDeleted?: boolean
          filePath?: string
          thumbnail?: string
        }

        if (!candidate.id || typeof candidate.id !== 'string') {
          return null
        }

        const tags = Array.isArray(candidate.tags)
          ? candidate.tags.filter((tag): tag is string => typeof tag === 'string')
          : typeof candidate.tags === 'string'
            ? candidate.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
            : undefined

        return {
          id: candidate.id,
          name: candidate.name || candidate.id,
          ext: candidate.ext,
          tags,
          annotation: candidate.annotation,
          isDeleted: candidate.isDeleted,
          filePath: candidate.filePath,
          thumbnail: candidate.thumbnail,
        }
      })
      .filter((item): item is EagleItemSearchResult => item !== null)
  }
}
