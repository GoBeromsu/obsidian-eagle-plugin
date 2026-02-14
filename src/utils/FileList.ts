import { isLikelyImageFile } from './image-format'

export function allFilesAreImages(files: FileList) {
  if (files.length === 0) return false

  for (const file of files) {
    if (!isLikelyImageFile(file)) return false
  }

  return true
}
