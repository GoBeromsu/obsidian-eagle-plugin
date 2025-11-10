import { Canvas } from 'obsidian'

import EaglePlugin from './EaglePlugin'
import ImageUploadBlockingModal from './ui/ImageUploadBlockingModal'
import { allFilesAreImages } from './utils/FileList'
import { buildPasteEventCopy } from './utils/events'

export function createEagleCanvasPasteHandler(
  plugin: EaglePlugin,
  originalPasteHandler: (e: ClipboardEvent) => Promise<void>,
) {
  return function (e: ClipboardEvent) {
    return eagleCanvasPaste.call(this, plugin, originalPasteHandler, e)
  }
}

async function eagleCanvasPaste(
  plugin: EaglePlugin,
  originalPasteHandler: (e: ClipboardEvent) => Promise<void>,
  e: ClipboardEvent,
) {
  const { files } = e.clipboardData
  if (!allFilesAreImages(files) || files.length != 1) {
    void originalPasteHandler.call(this, e)
    return
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const canvas: Canvas = this.canvas
  uploadImageOnCanvas(canvas, plugin, buildPasteEventCopy(e, files)).catch(() => {
    void originalPasteHandler.call(this, e)
  })
}

function uploadImageOnCanvas(canvas: Canvas, plugin: EaglePlugin, e: ClipboardEvent) {
  const modal = new ImageUploadBlockingModal(plugin.app)
  modal.open()

  const file = e.clipboardData.files[0]
  return plugin.eagleUploader
    .upload(file)
    .then((url) => {
      if (!modal.isOpen) {
        return
      }

      modal.close()
      pasteRemoteImageToCanvas(canvas, url)
    })
    .catch((err) => {
      modal.close()
      throw err
    })
}

function pasteRemoteImageToCanvas(canvas: Canvas, imageUrl: string) {
  canvas.createTextNode({
    pos: canvas.posCenter(),
    position: 'center',
    text: `![](${imageUrl})`,
  })
}
