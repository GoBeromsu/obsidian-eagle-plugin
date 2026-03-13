import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_SETTINGS } from '../src/plugin-settings'
import EagleApiError from '../src/uploader/EagleApiError'
import EagleUploader from '../src/uploader/EagleUploader'
import { __resetRequestUrlMock, __setRequestUrlMock } from './mocks/obsidian'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function successResponse(data: unknown) {
  return {
    status: 200,
    statusText: 'OK',
    json: { status: 'success', data },
    text: '',
  }
}

function errorResponse(status: number, message: string) {
  return {
    status,
    statusText: 'Bad Request',
    json: { status: 'error', message },
    text: message,
  }
}

/**
 * Build an App mock that captures `fs.unlink` calls so tests can verify
 * temp-file cleanup in the `upload()` finally block.
 */
function createAppMockWithUnlink(unlinkSpy: ReturnType<typeof vi.fn>) {
  return {
    vault: {
      adapter: {
        fs: {
          unlink: unlinkSpy,
          writeFile: vi.fn((_path: string, _buf: Buffer, cb: (err: null) => void) => cb(null)),
        },
        path: {
          join: (...parts: string[]) => parts.join('/'),
        },
      },
    },
  }
}

type UploaderPrivate = {
  saveToTempFile: (image: File) => Promise<string>
  ensureFolderExists: (name: string, signal?: AbortSignal) => Promise<string>
  addToEagle: (filePath: string, folderId: string | undefined, signal?: AbortSignal) => Promise<string>
  getFileUrlForItemId: (itemId: string, signal?: AbortSignal) => Promise<string>
  requestJson: <T>(url: string, method: string, body?: string, signal?: AbortSignal) => Promise<T>
}

function asPrivate(uploader: EagleUploader): UploaderPrivate {
  return uploader as unknown as UploaderPrivate
}

/** Create an uploader whose private methods can be spied on. */
function createUploader(app?: ReturnType<typeof createAppMockWithUnlink>) {
  return new EagleUploader((app ?? {}) as any, DEFAULT_SETTINGS)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EagleUploader — upload error / cancel paths', () => {
  beforeEach(() => {
    __resetRequestUrlMock()
    vi.useRealTimers()
  })

  // 1. Pre-aborted signal: upload() should throw DOMException(AbortError) immediately
  it('throws AbortError when signal is already aborted before upload starts', async () => {
    const controller = new AbortController()
    controller.abort()

    const uploader = createUploader()
    const internals = asPrivate(uploader)

    // saveToTempFile must resolve so the signal check inside upload() is reached
    vi.spyOn(internals, 'saveToTempFile').mockResolvedValue('/tmp/test.png')
    vi.spyOn(internals, 'ensureFolderExists').mockResolvedValue('folder-1')
    vi.spyOn(internals, 'addToEagle').mockResolvedValue('item-1')

    const error = await uploader
      .upload(new File([], 'test.png'), { signal: controller.signal })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(DOMException)
    expect((error as DOMException).name).toBe('AbortError')
  })

  // 2. Signal aborted mid-request: requestJson should reject with AbortError
  //    after requestUrl returns when the signal is aborted post-request.
  it('throws AbortError when signal is aborted after requestUrl returns', async () => {
    const controller = new AbortController()

    __setRequestUrlMock(async (_args: { url: string }) => {
      // Abort the signal while requestUrl is "in flight"
      controller.abort()
      return successResponse([])
    })

    const uploader = createUploader()
    const internals = asPrivate(uploader)

    const error = await internals
      .requestJson('/api/folder/list', 'GET', undefined, controller.signal)
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(DOMException)
    expect((error as DOMException).name).toBe('AbortError')
  })

  // 3. requestJson checks signal.aborted BEFORE making the request
  it('throws AbortError without calling requestUrl when signal is pre-aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    let requestUrlCalled = false
    __setRequestUrlMock(async () => {
      requestUrlCalled = true
      return successResponse([])
    })

    const uploader = createUploader()
    const internals = asPrivate(uploader)

    const error = await internals
      .requestJson('/api/folder/list', 'GET', undefined, controller.signal)
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(DOMException)
    expect((error as DOMException).name).toBe('AbortError')
    expect(requestUrlCalled).toBe(false)
  })

  // 4. EagleApiError propagation: non-2xx HTTP response produces EagleApiError
  it('throws EagleApiError when requestUrl returns a non-2xx status', async () => {
    __setRequestUrlMock(async () => errorResponse(500, 'Internal Server Error'))

    const uploader = createUploader()
    const internals = asPrivate(uploader)

    const error = await internals
      .requestJson('/api/folder/list', 'GET')
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(EagleApiError)
    expect((error as EagleApiError).message).toContain('Internal Server Error')
  })

  // 5. EagleApiError propagates through the full upload() call stack
  it('propagates EagleApiError thrown by addToEagle out of upload()', async () => {
    const uploader = createUploader()
    const internals = asPrivate(uploader)

    vi.spyOn(internals, 'saveToTempFile').mockResolvedValue('/tmp/test.png')
    vi.spyOn(internals, 'ensureFolderExists').mockResolvedValue('folder-1')
    vi.spyOn(internals, 'addToEagle').mockRejectedValue(new EagleApiError('Eagle offline'))

    const error = await uploader.upload(new File([], 'test.png')).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(EagleApiError)
    expect((error as EagleApiError).message).toBe('Eagle offline')
  })

  // 6. Temp file cleanup: finally block calls fs.unlink even when upload fails
  it('calls fs.unlink in finally block when upload fails', async () => {
    const unlinkSpy = vi.fn((_path: string, _cb: (err: null) => void) => {})
    const app = createAppMockWithUnlink(unlinkSpy)
    const uploader = createUploader(app)
    const internals = asPrivate(uploader)

    const tempPath = '/tmp/eagle-temp-abc.png'
    vi.spyOn(internals, 'saveToTempFile').mockResolvedValue(tempPath)
    vi.spyOn(internals, 'ensureFolderExists').mockResolvedValue('folder-1')
    vi.spyOn(internals, 'addToEagle').mockRejectedValue(new EagleApiError('Eagle offline'))

    await uploader.upload(new File([], 'test.png')).catch(() => {})

    expect(unlinkSpy).toHaveBeenCalledOnce()
    expect(unlinkSpy).toHaveBeenCalledWith(tempPath, expect.any(Function))
  })

  // 7. Temp file cleanup also runs on successful upload
  it('calls fs.unlink in finally block on successful upload', async () => {
    vi.useFakeTimers()

    const unlinkSpy = vi.fn((_path: string, _cb: (err: null) => void) => {})
    const app = createAppMockWithUnlink(unlinkSpy)
    const uploader = createUploader(app)
    const internals = asPrivate(uploader)

    const tempPath = '/tmp/eagle-temp-abc.png'
    vi.spyOn(internals, 'saveToTempFile').mockResolvedValue(tempPath)
    vi.spyOn(internals, 'ensureFolderExists').mockResolvedValue('folder-1')
    vi.spyOn(internals, 'addToEagle').mockResolvedValue('item-1')
    vi.spyOn(internals, 'getFileUrlForItemId').mockResolvedValue('file:///Users/me/test.png')

    const uploadPromise = uploader.upload(new File([], 'test.png'), { folderName: 'Photos' })
    await vi.advanceTimersByTimeAsync(400)
    await uploadPromise

    expect(unlinkSpy).toHaveBeenCalledOnce()
    expect(unlinkSpy).toHaveBeenCalledWith(tempPath, expect.any(Function))
  })

  // 8. AbortError during the processing delay (setTimeout inside upload)
  it('throws AbortError when signal is aborted during the processing delay', async () => {
    vi.useFakeTimers()

    const controller = new AbortController()
    const uploader = createUploader()
    const internals = asPrivate(uploader)

    vi.spyOn(internals, 'saveToTempFile').mockResolvedValue('/tmp/test.png')
    vi.spyOn(internals, 'ensureFolderExists').mockResolvedValue('folder-1')
    vi.spyOn(internals, 'addToEagle').mockResolvedValue('item-1')

    const resultPromise = uploader
      .upload(new File([], 'test.png'), { signal: controller.signal })
      .catch((e: unknown) => e)

    // Abort mid-delay (before the 300 ms EAGLE_PROCESSING_DELAY_MS elapses)
    await vi.advanceTimersByTimeAsync(100)
    controller.abort()
    await vi.advanceTimersByTimeAsync(300)

    const error = await resultPromise

    expect(error).toBeInstanceOf(DOMException)
    expect((error as DOMException).name).toBe('AbortError')
  })
})
