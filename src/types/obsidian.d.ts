import 'obsidian'

/** Shape of the internal Node.js fs/path fields exposed by Obsidian's desktop adapter. */
export interface NodeAdapterFs {
  readFile(path: string, callback: (err: NodeJS.ErrnoException | null, buffer: Buffer) => void): void
  writeFile(path: string, data: Buffer, callback: (err: NodeJS.ErrnoException | null) => void): void
  unlink(path: string, callback: (err: NodeJS.ErrnoException | null) => void): void
}

export interface NodeAdapterPath {
  join(...parts: string[]): string
}

export interface NodeDataAdapter {
  fs: NodeAdapterFs
  path: NodeAdapterPath
}

declare module 'obsidian' {
  interface MarkdownSubView {
    clipboardManager: ClipboardManager
  }

  interface CanvasView extends TextFileView {
    handlePaste: (e: ClipboardEvent) => Promise<void>
  }

  interface Editor {
    getClickableTokenAt(position: EditorPosition): ClickableToken | null
  }

  interface ClickableToken {
    displayText: string
    text: string
    type: string
    start: EditorPosition
    end: EditorPosition
  }

  interface Canvas {
    posCenter(): Point
    createTextNode(n: NewTextNode): unknown
  }

  interface NewTextNode {
    pos: Point
    position: string
    text: string
  }

  interface ClipboardManager {
    handlePaste(e: ClipboardEvent): void
    handleDrop(e: DragEvent): void
  }
}
