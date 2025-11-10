import { App, requestUrl } from 'obsidian'
import { tmpdir } from 'os'
import { EaglePluginSettings } from '../plugin-settings'
import EagleApiError from './EagleApiError'
import { generatePseudoRandomId } from '../utils/pseudo-random'

export default class EagleUploader {
  private readonly app: App
  private readonly settings: EaglePluginSettings

  constructor(app: App, settings: EaglePluginSettings) {
    this.app = app
    this.settings = settings
  }

  async upload(image: File): Promise<string> {
    console.log('[Eagle Upload] Starting upload...')

    const tempFilePath = await this.saveToTempFile(image)
    console.log('[Eagle Upload] Temp file created:', tempFilePath)

    const itemId = await this.addToEagle(tempFilePath)
    console.log('[Eagle Upload] Item added to Eagle, ID:', itemId)

    // Give Eagle a moment to process the file
    console.log('[Eagle Upload] Waiting for Eagle to process file...')
    await new Promise((resolve) => setTimeout(resolve, 300))

    const imagePath = await this.getThumbnailPath(itemId)
    console.log('[Eagle Upload] Thumbnail path retrieved:', imagePath)

    // Don't delete immediately - Eagle might still be reading the file
    // Let OS handle cleanup of temp files
    return imagePath
  }

  private async saveToTempFile(image: File): Promise<string> {
    const tempFileName = `eagle-temp-${generatePseudoRandomId()}.${image.name.split('.').pop()}`
    const adapter = this.app.vault.adapter as any

    // Use OS temp directory - let the OS handle cleanup
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
    const url = `http://${eagleHost}:${eaglePort}/api/item/addFromPath`

    console.log('[addToEagle] Calling API:', url)
    console.log('[addToEagle] File path:', filePath)

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
    console.log('[addToEagle] Response:', data)

    if (data?.status !== 'success') {
      const errorMsg = data?.message || 'Unknown error'
      console.error('[addToEagle] Error:', errorMsg)
      throw new EagleApiError(errorMsg)
    }

    // Eagle API returns the item ID directly in data field as a string
    const itemId = data?.data
    console.log('[addToEagle] Item ID:', itemId)
    return itemId
  }

  private async getThumbnailPath(itemId: string): Promise<string> {
    const { eagleHost, eaglePort } = this.settings
    const thumbnailUrl = `http://${eagleHost}:${eaglePort}/api/item/thumbnail?id=${itemId}`

    console.log('[getThumbnailPath] Calling API:', thumbnailUrl)

    const resp = await requestUrl({
      url: thumbnailUrl,
      method: 'GET',
      throw: false,
    })

    const data = resp.json
    console.log('[getThumbnailPath] Response:', data)

    if (data?.status === 'success' && data?.data) {
      // Remove _thumbnail suffix to get original image path
      const thumbnailPath = data.data
      const originalPath = thumbnailPath.replace(/_thumbnail(\.[^.]+)$/, '$1')
      const fileUrl = `file://${originalPath}`
      console.log('[getThumbnailPath] Thumbnail path:', thumbnailPath)
      console.log('[getThumbnailPath] Original path:', originalPath)
      console.log('[getThumbnailPath] Success! Returning file URL:', fileUrl)
      return fileUrl
    }

    // Fallback to eagle:// URL
    console.warn('[getThumbnailPath] Failed, using fallback URL')
    return `eagle://item/${itemId}`
  }
}
