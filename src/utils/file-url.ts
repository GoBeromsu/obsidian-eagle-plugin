const FILE_URL_PROTOCOL = 'file://'

function safeDecodePath(path: string): string | null {
  try {
    return decodeURIComponent(path)
  } catch {
    return null
  }
}

function normalizeEncodedPath(path: string): string {
  let normalized = path

  if (!/%[0-9A-Fa-f]{2}/.test(normalized)) {
    return normalized
  }

  const firstPass = safeDecodePath(normalized)
  if (firstPass === null) {
    return normalized
  }

  normalized = firstPass
  if (!/%[0-9A-Fa-f]{2}/.test(normalized)) {
    return normalized
  }

  const secondPass = safeDecodePath(normalized)
  return secondPass ?? firstPass
}

function encodePathSegment(segment: string) {
  return encodeURIComponent(segment).replaceAll('(', '%28').replaceAll(')', '%29')
}

/**
 * Convert an absolute file system path to a file:// URL that Obsidian reliably renders.
 *
 * - Normalizes Windows backslashes to forward slashes
 * - Percent-encodes per path segment
 * - Forces encoding of parentheses as %28/%29 (Obsidian is sensitive to raw parentheses)
 */
export function filePathToFileUrl(filePath: string): string {
  const normalized = filePath.replaceAll('\\', '/')

  // UNC path: \\server\share\path or //server/share/path
  if (normalized.startsWith('//')) {
    const withoutLeading = normalized.slice(2).replace(/\/{2,}/g, '/')
    const [host, ...rest] = withoutLeading.split('/')
    const encodedRest = rest.map((seg) => (seg === '' ? '' : encodePathSegment(seg)))
    return `${FILE_URL_PROTOCOL}${host}/${encodedRest.join('/')}`
  }

  // Windows drive path: C:/Users/...  →  /C:/Users/...
  const withLeadingSlash = /^[A-Za-z]:\//.test(normalized) ? `/${normalized}` : normalized

  const pathWithLeadingSlash = withLeadingSlash.startsWith('/') ? withLeadingSlash : `/${withLeadingSlash}`
  const segments = pathWithLeadingSlash.split('/')
  const encodedSegments = segments.map((seg) => {
    if (seg === '') return ''
    if (/^[A-Za-z]:$/.test(seg)) return seg
    return encodePathSegment(seg)
  })

  return `${FILE_URL_PROTOCOL}${encodedSegments.join('/')}`
}

/**
 * Convert an Eagle API path to a file:// URL that Obsidian reliably renders.
 *
 * Contract: Eagle API endpoints (/api/item/thumbnail, /api/item/list `filePath`)
 * return plain OS filesystem paths with no percent-encoding.
 * Example: `/Users/foo/Eagle.library/…/image_thumbnail.jpg`
 *
 * The decode step is kept defensively for edge cases where Eagle returns a
 * `file://` URL or percent-encoded path (observed on some Eagle versions).
 * When the path contains no `%XX` sequences the decode is a no-op.
 */
export function normalizeEagleApiPathToFileUrl(rawPath: string): string {
  let candidate = rawPath.trim()
  candidate = candidate.replace(/^file:\/\//, '').replace(/^\/\//, '')
  candidate = candidate.replaceAll('\\', '/')

  const decoded = normalizeEncodedPath(candidate)
  return filePathToFileUrl(decoded)
}

export function resolveEagleThumbnailUrl(
  rawThumbnail: string,
  eagleHost: string,
  eaglePort: number,
): string {
  const candidate = rawThumbnail.trim()
  if (!candidate) {
    return ''
  }

  if (/^https?:\/\//i.test(candidate)) {
    return candidate
  }

  if (/^\/?api\//i.test(candidate)) {
    const apiPath = candidate.startsWith('/') ? candidate : `/${candidate}`
    return `http://${eagleHost}:${eaglePort}${apiPath}`
  }

  return normalizeEagleApiPathToFileUrl(candidate)
}
