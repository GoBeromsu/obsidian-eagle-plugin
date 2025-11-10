import { App, requestUrl } from 'obsidian'
import { tmpdir } from 'os'
import { EaglePluginSettings } from '../plugin-settings'
import EagleApiError from './EagleApiError'
import { generatePseudoRandomId } from '../utils/pseudo-random'

const EAGLE_API_ENDPOINTS = {
  ADD_FROM_PATH: '/api/item/addFromPath',
  THUMBNAIL: '/api/item/thumbnail',
} as const

const EAGLE_PROCESSING_DELAY_MS = 300
const FILE_URL_PROTOCOL = 'file://'
const EAGLE_URL_PROTOCOL = 'eagle://item/'
const THUMBNAIL_SUFFIX_PATTERN = /_thumbnail(\.[^.]+)$/

export default class EagleUploader {
  private readonly app: App
  private readonly settings: EaglePluginSettings

  constructor(app: App, settings: EaglePluginSettings) {
    this.app = app
    this.settings = settings
  }

  async upload(image: File): Promise<string> {
    const tempFilePath = await this.saveToTempFile(image)
    const itemId = await this.addToEagle(tempFilePath)
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

  private async addToEagle(filePath: string): Promise<string> {
    const { eagleHost, eaglePort } = this.settings
    const url = `http://${eagleHost}:${eaglePort}${EAGLE_API_ENDPOINTS.ADD_FROM_PATH}`

    const resp = await requestUrl({
      url: url,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: filePath,
        name: filePath.split('/').pop(),
        annotation: 'Added via Obsidian Eagle Plugin',
      }),
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
}
