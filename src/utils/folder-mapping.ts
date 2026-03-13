import { ObsidianEagleFolderMapping } from '../plugin-settings'

export function normalizeVaultFolderPath(input: string): string {
  return input
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
}

export function folderPathFromFilePath(filePath: string | null): string {
  if (!filePath) {
    return ''
  }

  const normalizedFilePath = normalizeVaultFolderPath(filePath)
  if (!normalizedFilePath) {
    return ''
  }

  const slashIndex = normalizedFilePath.lastIndexOf('/')
  if (slashIndex === -1) {
    return ''
  }

  return normalizedFilePath.slice(0, slashIndex)
}

export function sanitizeFolderMappings(
  mappings: ObsidianEagleFolderMapping[],
): ObsidianEagleFolderMapping[] {
  return mappings
    .map((mapping) => ({
      obsidianFolder: normalizeVaultFolderPath(mapping.obsidianFolder),
      eagleFolder: normalizeVaultFolderPath(mapping.eagleFolder),
    }))
    .filter((mapping) => mapping.obsidianFolder !== '' && mapping.eagleFolder !== '')
}

export interface DestinationPreview {
  noteFolderPath: string
  matchedEagleFolder: string | undefined
  matchedObsidianRule: string | undefined
}

export function resolveDestinationPreview(
  filePath: string | null,
  mappings: ObsidianEagleFolderMapping[],
): DestinationPreview {
  const noteFolderPath = folderPathFromFilePath(filePath)
  const sanitizedMappings = sanitizeFolderMappings(mappings)

  let matchedEagleFolder: string | undefined
  let matchedObsidianRule: string | undefined
  let matchedLength = -1

  for (const mapping of sanitizedMappings) {
    const { obsidianFolder, eagleFolder } = mapping
    const isMatch =
      noteFolderPath === obsidianFolder ||
      noteFolderPath.startsWith(`${obsidianFolder}/`)

    if (!isMatch) {
      continue
    }

    if (obsidianFolder.length >= matchedLength) {
      matchedLength = obsidianFolder.length
      matchedEagleFolder = eagleFolder
      matchedObsidianRule = obsidianFolder
    }
  }

  return { noteFolderPath, matchedEagleFolder, matchedObsidianRule }
}

export function resolveMappedEagleFolder(
  filePath: string | null,
  mappings: ObsidianEagleFolderMapping[],
): string | undefined {
  return resolveDestinationPreview(filePath, mappings).matchedEagleFolder
}
