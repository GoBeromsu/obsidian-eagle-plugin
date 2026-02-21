interface RequestUrlArgs {
  url: string
  method: string
  headers?: Record<string, string>
  body?: string
  throw?: boolean
}

type RequestUrlImpl = (args: RequestUrlArgs) => Promise<unknown>

const defaultRequestUrlImpl: RequestUrlImpl = () =>
  Promise.reject(new Error('requestUrl mock is not configured for this test'))

let requestUrlImpl: RequestUrlImpl = defaultRequestUrlImpl

export class App {}

export function __setRequestUrlMock(impl: RequestUrlImpl): void {
  requestUrlImpl = impl
}

export function __resetRequestUrlMock(): void {
  requestUrlImpl = defaultRequestUrlImpl
}

export async function requestUrl(args: RequestUrlArgs): Promise<unknown> {
  return requestUrlImpl(args)
}
