export type FallbackImageFormat = 'jpeg' | 'png' | 'webp'

export interface ObsidianEagleFolderMapping {
  obsidianFolder: string
  eagleFolder: string
}

export interface EaglePluginSettings {
  eagleHost: string
  eaglePort: number
  eagleFolderName: string
  folderMappings: ObsidianEagleFolderMapping[]
  debugSearchDiagnostics: boolean
  fallbackImageFormat: FallbackImageFormat
  conversionQualityForJpeg: number
}

export const DEFAULT_SETTINGS: EaglePluginSettings = {
  eagleHost: 'localhost',
  eaglePort: 41595,
  eagleFolderName: '',
  folderMappings: [],
  debugSearchDiagnostics: false,
  fallbackImageFormat: 'jpeg',
  conversionQualityForJpeg: 0.9,
}
