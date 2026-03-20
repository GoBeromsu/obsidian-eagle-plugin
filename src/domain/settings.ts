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
  cacheFolderName: string
  deduplicateUploads: boolean
  searchDebounceMs: number
  uploadItemNameTemplate: string
  plugin_notices?: { muted: Record<string, boolean> }
}

export const DEFAULT_SETTINGS: EaglePluginSettings = {
  eagleHost: 'localhost',
  eaglePort: 41595,
  eagleFolderName: '',
  folderMappings: [],
  debugSearchDiagnostics: false,
  cacheFolderName: 'eagle-cache',
  deduplicateUploads: true,
  searchDebounceMs: 300,
  uploadItemNameTemplate: '{uuid}_{noteName}',
}
