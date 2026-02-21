import { describe, expect, it } from 'vitest'

import {
  folderPathFromFilePath,
  normalizeVaultFolderPath,
  resolveMappedEagleFolder,
  sanitizeFolderMappings,
} from '../src/utils/folder-mapping'

describe(normalizeVaultFolderPath.name, () => {
  it('trims surrounding spaces and slashes', () => {
    expect(normalizeVaultFolderPath(' /Projects/Design/ ')).toBe('Projects/Design')
  })
})

describe(folderPathFromFilePath.name, () => {
  it('extracts folder path from markdown file path', () => {
    expect(folderPathFromFilePath('Projects/Design/note.md')).toBe('Projects/Design')
  })

  it('returns empty string for root level files', () => {
    expect(folderPathFromFilePath('note.md')).toBe('')
  })
})

describe(sanitizeFolderMappings.name, () => {
  it('removes invalid rows and keeps duplicates for later resolution', () => {
    const sanitized = sanitizeFolderMappings([
      { obsidianFolder: ' ', eagleFolder: 'Design' },
      { obsidianFolder: 'Projects', eagleFolder: ' ' },
      { obsidianFolder: 'Projects', eagleFolder: 'Inbox' },
      { obsidianFolder: '/Projects/', eagleFolder: 'Archive' },
    ])

    expect(sanitized).toEqual([
      { obsidianFolder: 'Projects', eagleFolder: 'Inbox' },
      { obsidianFolder: 'Projects', eagleFolder: 'Archive' },
    ])
  })
})

describe(resolveMappedEagleFolder.name, () => {
  const mappings = [
    { obsidianFolder: 'Projects', eagleFolder: 'Eagle Projects' },
    { obsidianFolder: 'Projects/Design', eagleFolder: 'Eagle Design' },
  ]

  it('prefers longest matching prefix', () => {
    expect(resolveMappedEagleFolder('Projects/Design/specs/note.md', mappings)).toBe('Eagle Design')
  })

  it('matches exact folder path', () => {
    expect(resolveMappedEagleFolder('Projects/note.md', mappings)).toBe('Eagle Projects')
  })

  it('returns undefined when no mapping exists', () => {
    expect(resolveMappedEagleFolder('Journal/note.md', mappings)).toBeUndefined()
  })

  it('uses last duplicate mapping when keys are same length', () => {
    const duplicateMappings = [
      { obsidianFolder: 'Projects', eagleFolder: 'First' },
      { obsidianFolder: 'Projects', eagleFolder: 'Second' },
    ]

    expect(resolveMappedEagleFolder('Projects/note.md', duplicateMappings)).toBe('Second')
  })
})
