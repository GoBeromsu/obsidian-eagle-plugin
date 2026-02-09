import { describe, expect, it } from 'vitest'

import { findMarkdownImageTokens } from '../src/utils/markdown-image'

describe(findMarkdownImageTokens, () => {
  it('finds image links containing spaces and parentheses', () => {
    const md = 'Hello ![](file:///Users/me/images/ID.info/우리가 (PFD).jpg) world'
    const tokens = findMarkdownImageTokens(md)
    expect(tokens).toHaveLength(1)
    expect(tokens[0].alt).toBe('')
    expect(tokens[0].link).toBe('file:///Users/me/images/ID.info/우리가 (PFD).jpg')
  })

  it('skips fenced code blocks', () => {
    const md = [
      '```md',
      '![](file:///Users/me/images/ID.info/a b.jpg)',
      '```',
      '',
      '![](file:///Users/me/images/ID.info/c d.jpg)',
    ].join('\n')
    const tokens = findMarkdownImageTokens(md)
    expect(tokens).toHaveLength(1)
    expect(tokens[0].link).toContain('c d.jpg')
  })
})
