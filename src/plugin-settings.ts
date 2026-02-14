export type FallbackImageFormat = 'jpeg' | 'png' | 'webp'

export interface EaglePluginSettings {
  eagleHost: string
  eaglePort: number
  eagleFolderName: string
  fallbackImageFormat: FallbackImageFormat
  conversionQualityForJpeg: number
}

export const DEFAULT_SETTINGS: EaglePluginSettings = {
  eagleHost: 'localhost',
  eaglePort: 41595,
  eagleFolderName: '',
  fallbackImageFormat: 'jpeg',
  conversionQualityForJpeg: 0.9,
}
