import { App, requestUrl } from 'obsidian'
import { tmpdir } from 'os'
import { EaglePluginSettings } from '../plugin-settings'
import EagleApiError from './EagleApiError'
import { generatePseudoRandomId } from '../utils/pseudo-random'

const EAGLE_API_ENDPOINTS = {
  ADD_FROM_PATH: '/api/item/addFromPath',
  THUMBNAIL: '/api/item/thumbnail',
  FOLDER_LIST: '/api/folder/list',
  FOLDER_CREATE: '/api/folder/create',
} as const

const EAGLE_PROCESSING_DELAY_MS = 300
const FILE_URL_PROTOCOL = 'file://'
const EAGLE_URL_PROTOCOL = 'eagle://item/'
const THUMBNAIL_SUFFIX_PATTERN = /_thumbnail(\.[^.]+)$/

interface EagleFolder {
  id: string
  name: string
}

export default class EagleUploader {
  private readonly app: App
  private readonly settings: EaglePluginSettings
  private folderIdCache: Map<string, string> = new Map()

  constructor(app: App, settings: EaglePluginSettings) {
    this.app = app
    this.settings = settings
  }

  async upload(image: File): Promise<string> {
    const tempFilePath = await this.saveToTempFile(image)

    let folderId: string | undefined
    if (this.settings.eagleFolderName) {
      folderId = await this.ensureFolderExists(this.settings.eagleFolderName)
    }

    const itemId = await this.addToEagle(tempFilePath, folderId)
    await new Promise((resolve) => setTimeout(resolve, EAGLE_PROCESSING_DELAY_MS))
    const imagePath = await this.getImagePath(itemId)
    return imagePath
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
        if (err) reject(err)
        else resolve(tempFilePath)
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

    const resp = await requestUrl({
      url: url,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      throw: false,
    })

    const data = resp.json

    if (data?.status !== 'success') {
      const errorMsg = data?.message || 'Unknown error'
      throw new EagleApiError(errorMsg)
    }

    return data?.data
  }

  private async getImagePath(itemId: string): Promise<string> {
    const { eagleHost, eaglePort } = this.settings
    const url = `http://${eagleHost}:${eaglePort}${EAGLE_API_ENDPOINTS.THUMBNAIL}?id=${itemId}`

    const resp = await requestUrl({
      url: url,
      method: 'GET',
      throw: false,
    })

    const data = resp.json

    if (data?.status === 'success' && data?.data) {
      const thumbnailPath = data.data
      const originalPath = thumbnailPath.replace(THUMBNAIL_SUFFIX_PATTERN, '$1')
      return `${FILE_URL_PROTOCOL}${originalPath}`
    }

    return `${EAGLE_URL_PROTOCOL}${itemId}`
  }

  async listFolders(): Promise<EagleFolder[]> {
    const { eagleHost, eaglePort } = this.settings
    const url = `http://${eagleHost}:${eaglePort}${EAGLE_API_ENDPOINTS.FOLDER_LIST}`

    const resp = await requestUrl({
      url: url,
      method: 'GET',
      throw: false,
    })

    const data = resp.json

    if (data?.status === 'success' && data?.data) {
      return data.data.map((folder: { id: string; name: string }) => ({
        id: folder.id,
        name: folder.name,
      }))
    }

    throw new EagleApiError('Failed to list folders')
  }

  async createFolder(name: string): Promise<string> {
    const { eagleHost, eaglePort } = this.settings
    const url = `http://${eagleHost}:${eaglePort}${EAGLE_API_ENDPOINTS.FOLDER_CREATE}`

    const resp = await requestUrl({
      url: url,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderName: name }),
      throw: false,
    })

    const data = resp.json

    if (data?.status === 'success' && data?.data?.id) {
      return data.data.id
    }

    throw new EagleApiError('Failed to create folder')
  }

  async ensureFolderExists(name: string): Promise<string> {
    if (this.folderIdCache.has(name)) {
      return this.folderIdCache.get(name)!
    }

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
}
