import { EditorPosition, ReferenceCache } from 'obsidian'

import { EaglePluginSettings, FallbackImageFormat } from '../plugin-settings'
import {
  canonicalImageExtensionForFormat,
  detectImageFormat,
  isKnownImageExtension,
  isRenderableImageExtension,
  mimeTypeForFallbackFormat,
  replaceFileExtension,
} from './image-format'

function passesInstanceofCheck(image: File): boolean {
  return image instanceof File
}

function normalizeImageForBrowser(image: File): File {
  if (passesInstanceofCheck(image)) {
    return image
  }

  return new File([image], image.name, {
    type: image.type,
    lastModified: image.lastModified,
  })
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

async function decodeImageElement(image: File): Promise<HTMLImageElement> {
  const element = new Image()
  const objectUrl = URL.createObjectURL(image)

  try {
    await new Promise<void>((resolve, reject) => {
      element.onload = () => resolve()
      element.onerror = () => reject(new Error('Failed to decode image for conversion'))
      element.src = objectUrl
    })

    return element
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function hasClose(resource: ImageBitmap | HTMLImageElement): resource is ImageBitmap {
  return 'close' in resource && typeof resource.close === 'function'
}

async function convertImageToFormat(
  image: File,
  format: FallbackImageFormat,
  quality: number,
): Promise<File> {
  if (typeof document === 'undefined' || !document.createElement) {
    throw new Error('Canvas conversion is not available in this runtime')
  }

  const fileMimeType = mimeTypeForFallbackFormat(format)
  if (!fileMimeType) {
    throw new Error(`Unsupported conversion format: ${format}`)
  }

  let source: ImageBitmap | HTMLImageElement
  try {
    if (typeof createImageBitmap === 'function') {
      source = await createImageBitmap(image)
    } else {
      source = await decodeImageElement(image)
    }
  } catch {
    source = await decodeImageElement(image)
  }

  const { width, height } = source
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    if (hasClose(source)) {
      source.close()
    }
    throw new Error('Unable to get 2D context for image conversion')
  }

  canvas.width = width
  canvas.height = height

  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  ctx.drawImage(source, 0, 0)

  if (hasClose(source)) {
    source.close()
  }

  const extension = canonicalImageExtensionForFormat(format)
  const convertedName = replaceFileExtension(image.name, extension)
  const normalizedQuality = clampNumber(quality, 0, 1)
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, fileMimeType, format === 'jpeg' ? normalizedQuality : undefined),
  )

  if (!blob) {
    throw new Error(`Failed to convert image to ${format}`)
  }

  return new File([blob], convertedName, {
    type: fileMimeType,
    lastModified: image.lastModified,
  })
}

function ensureTypeAndExtensionMatch(
  image: File,
  detected: ReturnType<typeof detectImageFormat>,
): File {
  const hasType = Boolean(detected.mimeType)
  const hasExtension = Boolean(detected.extension)
  const shouldChangeType = hasType && image.type !== detected.mimeType

  if (!hasExtension) {
    return shouldChangeType
      ? new File([image], image.name, {
          type: detected.mimeType,
          lastModified: image.lastModified,
        })
      : image
  }

  const nextName = replaceFileExtension(image.name, detected.extension)
  const shouldChangeName = nextName !== image.name

  if (!shouldChangeType && !shouldChangeName) {
    return image
  }

  return new File([image], nextName, {
    type: hasType ? detected.mimeType : image.type,
    lastModified: image.lastModified,
  })
}

export async function normalizeImageForUpload(image: File, settings: EaglePluginSettings): Promise<File> {
  const normalized = normalizeImageForBrowser(image)
  const detected = detectImageFormat(await normalized.arrayBuffer(), normalized.name, normalized.type)

  const shouldAttemptConversion =
    isKnownImageExtension(detected.extension) ||
    (detected.source === 'signature' && Boolean(detected.extension)) ||
    normalized.type.startsWith('image/')

  if (detected.recognized && isRenderableImageExtension(detected.extension)) {
    return ensureTypeAndExtensionMatch(normalized, detected)
  }

  if (!shouldAttemptConversion) {
    return normalized
  }

  return convertImageToFormat(
    normalized,
    settings.fallbackImageFormat,
    settings.conversionQualityForJpeg,
  )
}

function removeReferenceIfPresent(
  referencesByNote: Record<string, ReferenceCache[]>,
  referenceToRemove: { path: string; startPosition: EditorPosition },
) {
  if (!Object.keys(referencesByNote).includes(referenceToRemove.path)) return

  const refsFromOriginalNote = referencesByNote[referenceToRemove.path]
  const originalRefStart = referenceToRemove.startPosition
  const refForExclusion = refsFromOriginalNote.find(
    (r) =>
      r.position.start.line === originalRefStart.line &&
      r.position.start.col === originalRefStart.ch,
  )
  if (refForExclusion) {
    refsFromOriginalNote.remove(refForExclusion)
    if (refsFromOriginalNote.length === 0) {
      delete referencesByNote[referenceToRemove.path]
    }
  }
}

async function fixImageTypeIfNeeded(image: File): Promise<File> {
  const normalized = normalizeImageForBrowser(image)
  const detected = detectImageFormat(await normalized.arrayBuffer(), normalized.name, normalized.type)
  return detected.recognized ? ensureTypeAndExtensionMatch(normalized, detected) : normalized
}

export { fixImageTypeIfNeeded, removeReferenceIfPresent }
