import { App, normalizePath, requestUrl, TFile } from 'obsidian'
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
    const tempFile = await this.saveToTempFile(image)
    try {
      const eagleUrl = await this.uploadFromPath(tempFile)
      return eagleUrl
    } finally {
      await this.app.vault.delete(tempFile)
    }
  }

  private async saveToTempFile(image: File): Promise<TFile> {
    const tempFileName = `eagle-temp-${generatePseudoRandomId()}.${image.name.split('.').pop()}`
    const tempFilePath = normalizePath(this.app.vault.configDir + '/' + tempFileName)

    const arrayBuffer = await image.arrayBuffer()
    return this.app.vault.createBinary(tempFilePath, arrayBuffer)
  }

  private async uploadFromPath(file: TFile): Promise<string> {
    const filePath = (this.app.vault.adapter as any).path.normalize(file.path)
    const { eagleHost, eaglePort } = this.settings

    const resp = await requestUrl({
      url: `http://${eagleHost}:${eaglePort}/api/item/addFromPath`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: filePath,
        name: file.name,
        annotation: 'Added via Obsidian Eagle Plugin',
      }),
      throw: false,
    })

    const json = resp.json
    if (json.status !== 'success') {
      throw new EagleApiError(json.message || 'Unknown error')
    }

    return `eagle://item/${json.data.id}`
  }
}
