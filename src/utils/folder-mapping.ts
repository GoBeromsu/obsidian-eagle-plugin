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

export function resolveMappedEagleFolder(
  filePath: string | null,
  mappings: ObsidianEagleFolderMapping[],
): string | undefined {
  const currentFolderPath = folderPathFromFilePath(filePath)
  const sanitizedMappings = sanitizeFolderMappings(mappings)

  let matchedFolder: string | undefined
  let matchedLength = -1

  for (const mapping of sanitizedMappings) {
    const { obsidianFolder, eagleFolder } = mapping
    const isMatch =
      currentFolderPath === obsidianFolder ||
      currentFolderPath.startsWith(`${obsidianFolder}/`)

    if (!isMatch) {
      continue
    }

    if (obsidianFolder.length >= matchedLength) {
      matchedLength = obsidianFolder.length
      matchedFolder = eagleFolder
    }
  }

  return matchedFolder
}
