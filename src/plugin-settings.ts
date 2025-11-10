export interface EaglePluginSettings {
  eagleHost: string
  eaglePort: number
  eagleFolderName: string
}

export const DEFAULT_SETTINGS: EaglePluginSettings = {
  eagleHost: 'localhost',
  eaglePort: 41595,
  eagleFolderName: '',
}
