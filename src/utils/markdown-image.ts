export interface MarkdownImageToken {
  alt: string
  link: string
  start: number
  end: number
}

interface Range {
  start: number
  end: number
}

function isOffsetInRanges(offset: number, ranges: Range[]) {
  return ranges.some((r) => offset >= r.start && offset < r.end)
}

function fencedCodeBlockRanges(markdown: string): Range[] {
  const ranges: Range[] = []

  let openFence: '```' | '~~~' | null = null
  let openStart = 0

  let offset = 0
  const lines = markdown.split('\n')
  for (const line of lines) {
    const trimmed = line.trimStart()
    const fence = trimmed.startsWith('```') ? '```' : trimmed.startsWith('~~~') ? '~~~' : null

    if (fence) {
      if (openFence === null) {
        openFence = fence
        openStart = offset
      } else if (openFence === fence) {
        // include closing fence line
        ranges.push({ start: openStart, end: offset + line.length + 1 })
        openFence = null
      }
    }

    offset += line.length + 1
  }

  if (openFence !== null) {
    ranges.push({ start: openStart, end: markdown.length })
  }

  return ranges
}

function findClosingUnescaped(markdown: string, start: number, closingChar: string) {
  let escaped = false
  for (let i = start; i < markdown.length; i += 1) {
    const ch = markdown[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (ch === '\\') {
      escaped = true
      continue
    }
    if (ch === closingChar) return i
  }
  return -1
}

function findMatchingParen(markdown: string, openParenIndex: number) {
  let depth = 0
  let escaped = false
  for (let i = openParenIndex; i < markdown.length; i += 1) {
    const ch = markdown[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (ch === '\\') {
      escaped = true
      continue
    }
    if (ch === '(') {
      depth += 1
      continue
    }
    if (ch === ')') {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

/**
 * Finds Markdown image tokens of the form: ![alt](link)
 *
 * Notes:
 * - Uses parenthesis balancing to tolerate raw parentheses in file paths.
 * - Skips fenced code blocks (``` / ~~~) to avoid rewriting examples.
 */
export function findMarkdownImageTokens(markdown: string): MarkdownImageToken[] {
  const tokens: MarkdownImageToken[] = []
  const codeRanges = fencedCodeBlockRanges(markdown)

  let idx = 0
  while (idx < markdown.length) {
    const start = markdown.indexOf('![', idx)
    if (start === -1) break
    idx = start + 2

    if (isOffsetInRanges(start, codeRanges)) {
      continue
    }

    const altStart = start + 2
    const altEnd = findClosingUnescaped(markdown, altStart, ']')
    if (altEnd === -1) continue

    let p = altEnd + 1
    while (p < markdown.length && /\s/.test(markdown[p])) p += 1
    if (markdown[p] !== '(') continue

    const parenOpen = p
    const parenClose = findMatchingParen(markdown, parenOpen)
    if (parenClose === -1) continue

    tokens.push({
      start,
      end: parenClose + 1,
      alt: markdown.slice(altStart, altEnd),
      link: markdown.slice(parenOpen + 1, parenClose).trim(),
    })

    idx = parenClose + 1
  }

  return tokens
}

export interface WikilinkEmbedToken {
  itemId: string
  ext: string
  start: number
  end: number
}

/**
 * Finds Eagle wikilink embed tokens of the form: ![[.eagle/ITEMID.EXT]]
 * Skips fenced code blocks.
 */
export function findEagleWikilinkTokens(markdown: string): WikilinkEmbedToken[] {
  const tokens: WikilinkEmbedToken[] = []
  const codeRanges = fencedCodeBlockRanges(markdown)
  const pattern = /!\[\[\.eagle\/([^.\]]+)\.([^\]]+)\]\]/g

  for (const match of markdown.matchAll(pattern)) {
    if (isOffsetInRanges(match.index, codeRanges)) continue
    tokens.push({
      itemId: match[1],
      ext: match[2],
      start: match.index,
      end: match.index + match[0].length,
    })
  }

  return tokens
}

/**
 * Applies a list of text replacements to `content` in reverse order so that
 * earlier character positions remain valid after each splice.
 */
export function applyTextReplacements(
  content: string,
  replacements: { start: number; end: number; text: string }[],
): string {
  const sorted = [...replacements].sort((a, b) => b.start - a.start)
  let result = content
  for (const r of sorted) {
    result = result.slice(0, r.start) + r.text + result.slice(r.end)
  }
  return result
}

