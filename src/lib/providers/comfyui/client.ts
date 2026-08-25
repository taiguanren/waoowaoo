import type { ComfyUiMediaType, ComfyUiOutput, ComfyUiResult, ComfyUiWorkflow } from './types'

const TERMINAL_FAILURE_STATES = new Set(['failed', 'error', 'cancelled', 'canceled'])
const TERMINAL_SUCCESS_STATES = new Set(['completed', 'success', 'succeeded'])

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function isNativeEndpoint(response: Response): boolean {
  return response.status === 404 || response.status === 405
}

function normalizeBaseUrl(rawBaseUrl: string): URL {
  const value = rawBaseUrl.trim()
  if (!value) throw new Error('COMFYUI_BASE_URL_MISSING')

  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('COMFYUI_BASE_URL_INVALID')
  }

  const normalizedPath = url.pathname.replace(/\/+$/, '')
  if (normalizedPath === '/docs' || normalizedPath === '/openapi.json') {
    url.pathname = '/'
  }
  return url
}

function describeNetworkError(error: unknown): string {
  if (!(error instanceof Error)) return String(error)
  const cause = error.cause
  const causeMessage = cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : ''
  return causeMessage && causeMessage !== error.message
    ? `${error.message}; cause: ${causeMessage}`
    : error.message
}

async function fetchComfyUi(input: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init)
  } catch (error) {
    throw new Error(`COMFYUI_NETWORK_ERROR: ${describeNetworkError(error)}`, { cause: error })
  }
}

export function buildComfyUiUrl(baseUrl: string, path: string, apiToken: string): string {
  const url = normalizeBaseUrl(baseUrl)
  const basePath = url.pathname.replace(/\/+$/, '')
  url.pathname = `${basePath}${path.startsWith('/') ? path : `/${path}`}` || '/'
  url.searchParams.set('token', apiToken)
  return url.toString()
}

async function readResult(response: Response): Promise<ComfyUiResult> {
  const raw = await response.text().catch(() => '')
  if (!response.ok) {
    throw new Error(`COMFYUI_REQUEST_FAILED: ${response.status} ${raw.slice(0, 500)}`.trim())
  }
  if (!raw.trim()) throw new Error('COMFYUI_RESPONSE_EMPTY')

  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch {
    throw new Error('COMFYUI_RESPONSE_INVALID_JSON')
  }
  if (!asRecord(parsed)) throw new Error('COMFYUI_RESPONSE_INVALID')
  return parsed as ComfyUiResult
}

function createNativeClientId(): string {
  return globalThis.crypto?.randomUUID?.() || `waoowaoo-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function nativeOutputUrl(baseUrl: string, apiToken: string, output: ComfyUiOutput): string | null {
  const filename = typeof output.filename === 'string' ? output.filename.trim() : ''
  if (!filename) return null
  const url = new URL(buildComfyUiUrl(baseUrl, '/view', apiToken))
  url.searchParams.set('filename', filename)
  url.searchParams.set('subfolder', typeof output.subfolder === 'string' ? output.subfolder : '')
  url.searchParams.set('type', typeof output.type === 'string' ? output.type : 'output')
  return url.toString()
}

function extractNativeOutputs(
  history: Record<string, unknown>,
  baseUrl: string,
  apiToken: string,
  mediaType: ComfyUiMediaType,
): string | null {
  const outputs = asRecord(history.outputs)
  if (!outputs) return null
  const preferredKeys = mediaType === 'video'
    ? ['videos', 'gifs', 'video', 'images']
    : ['images', 'image']
  const candidates: ComfyUiOutput[] = []
  for (const nodeOutput of Object.values(outputs)) {
    const record = asRecord(nodeOutput)
    if (!record) continue
    for (const key of preferredKeys) {
      const values = Array.isArray(record[key]) ? record[key] : [record[key]]
      for (const value of values) {
        const item = asRecord(value)
        if (item && typeof item.filename === 'string') candidates.push(item as ComfyUiOutput)
      }
      if (candidates.length > 0) break
    }
  }
  const output = candidates[0]
  return output ? nativeOutputUrl(baseUrl, apiToken, output) : null
}

async function submitNativeComfyUiWorkflow(params: {
  baseUrl: string
  apiToken: string
  workflow: ComfyUiWorkflow
}): Promise<string | null> {
  const response = await fetchComfyUi(buildComfyUiUrl(params.baseUrl, '/prompt', params.apiToken), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: params.workflow,
      client_id: createNativeClientId(),
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(30_000),
  })
  if (isNativeEndpoint(response)) return null
  const result = await readResult(response) as Record<string, unknown>
  const nodeErrors = asRecord(result.node_errors)
  if (nodeErrors && Object.keys(nodeErrors).length > 0) {
    throw new Error(`COMFYUI_REQUEST_FAILED: native node errors ${JSON.stringify(nodeErrors).slice(0, 1000)}`)
  }
  const requestId = typeof result.prompt_id === 'string' ? result.prompt_id.trim() : ''
  if (!requestId) throw new Error('COMFYUI_REQUEST_ID_MISSING')
  return requestId
}

export async function submitComfyUiWorkflow(params: {
  baseUrl: string
  apiToken: string
  workflow: ComfyUiWorkflow
}): Promise<string> {
  const response = await fetchComfyUi(buildComfyUiUrl(params.baseUrl, '/generate', params.apiToken), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: {
        request_id: '',
        workflow_json: params.workflow,
        return_outputs_as_base64: true,
      },
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(30_000),
  })
  if (isNativeEndpoint(response)) {
    const nativeRequestId = await submitNativeComfyUiWorkflow(params)
    if (nativeRequestId) return nativeRequestId
  }
  const result = await readResult(response)
  const requestId = typeof result.id === 'string' ? result.id.trim() : ''
  if (!requestId) throw new Error('COMFYUI_REQUEST_ID_MISSING')
  return requestId
}

export function extractComfyUiOutputDataUrl(
  result: ComfyUiResult,
  mediaType: ComfyUiMediaType,
): string | null {
  const outputs = Array.isArray(result.output) ? result.output : []
  const preferredType = mediaType === 'video' ? 'video' : 'image'
  const output = outputs.find((item) => {
    const outputType = typeof item.output_type === 'string' ? item.output_type.toLowerCase() : ''
    const mimeType = typeof item.mimetype === 'string' ? item.mimetype.toLowerCase() : ''
    return outputType.includes(preferredType) || mimeType.startsWith(`${preferredType}/`)
  }) || outputs[0]
  if (!output) return null

  const directUrl = typeof output.url === 'string' ? output.url.trim() : ''
  if (directUrl) return directUrl

  const data = typeof output.data === 'string' ? output.data.trim() : ''
  if (!data) return null
  if (data.startsWith('data:')) return data

  const fallbackMime = mediaType === 'video' ? 'video/mp4' : 'image/png'
  const mimeType = typeof output.mimetype === 'string' && output.mimetype.trim()
    ? output.mimetype.trim()
    : fallbackMime
  return `data:${mimeType};base64,${data}`
}

function readComfyUiError(result: ComfyUiResult): string {
  const response = asRecord(result.comfyui_response)
  const responseError = response && typeof response.error === 'string' ? response.error.trim() : ''
  const message = typeof result.message === 'string' ? result.message.trim() : ''
  return responseError || message || 'COMFYUI_TASK_FAILED'
}

export async function queryComfyUiResult(params: {
  baseUrl: string
  apiToken: string
  requestId: string
  mediaType: ComfyUiMediaType
}): Promise<{
  status: 'pending' | 'completed' | 'failed'
  resultUrl?: string
  error?: string
}> {
  const path = `/result/${encodeURIComponent(params.requestId)}`
  const response = await fetchComfyUi(buildComfyUiUrl(params.baseUrl, path, params.apiToken), {
    method: 'GET',
    cache: 'no-store',
    signal: AbortSignal.timeout(30_000),
  })
  if (isNativeEndpoint(response)) {
    const historyResponse = await fetchComfyUi(buildComfyUiUrl(
      params.baseUrl,
      `/history/${encodeURIComponent(params.requestId)}`,
      params.apiToken,
    ), {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    })
    if (historyResponse.status === 404) return { status: 'pending' }
    const historyPayload = await readResult(historyResponse) as Record<string, unknown>
    const historyRecord = asRecord(historyPayload[params.requestId]) || historyPayload
    const statusRecord = asRecord(historyRecord.status)
    const statusValue = typeof statusRecord?.status_str === 'string'
      ? statusRecord.status_str.trim().toLowerCase()
      : ''
    if (statusValue === 'error' || statusValue === 'failed') {
      return { status: 'failed', error: 'COMFYUI_TASK_FAILED' }
    }
    const resultUrl = extractNativeOutputs(historyRecord, params.baseUrl, params.apiToken, params.mediaType)
    if (!resultUrl) return { status: 'pending' }
    return { status: 'completed', resultUrl }
  }
  const result = await readResult(response)
  const status = typeof result.status === 'string' ? result.status.trim().toLowerCase() : ''

  if (TERMINAL_FAILURE_STATES.has(status)) {
    return { status: 'failed', error: readComfyUiError(result) }
  }
  if (!TERMINAL_SUCCESS_STATES.has(status)) {
    return { status: 'pending' }
  }

  const resultUrl = extractComfyUiOutputDataUrl(result, params.mediaType)
  if (!resultUrl) {
    return {
      status: 'failed',
      error: 'COMFYUI_OUTPUT_MISSING',
    }
  }
  return { status: 'completed', resultUrl }
}

export async function probeComfyUiConnection(params: {
  baseUrl: string
  apiToken: string
}): Promise<{ queueSize: number }> {
  const response = await fetchComfyUi(buildComfyUiUrl(params.baseUrl, '/queue-info', params.apiToken), {
    method: 'GET',
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  })
  if (isNativeEndpoint(response)) {
    const nativeResponse = await fetchComfyUi(buildComfyUiUrl(params.baseUrl, '/queue', params.apiToken), {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    })
    if (nativeResponse.status === 404) {
      throw new Error('COMFYUI_PROBE_FAILED: wrapper and native queue endpoints not found')
    }
    const nativePayload = await readResult(nativeResponse) as Record<string, unknown>
    const running = Array.isArray(nativePayload.queue_running) ? nativePayload.queue_running.length : 0
    const pending = Array.isArray(nativePayload.queue_pending) ? nativePayload.queue_pending.length : 0
    return { queueSize: running + pending }
  }
  const raw = await response.text().catch(() => '')
  if (!response.ok) {
    throw new Error(`COMFYUI_PROBE_FAILED: ${response.status} ${raw.slice(0, 300)}`.trim())
  }

  let payload: unknown
  try {
    payload = raw ? JSON.parse(raw) as unknown : {}
  } catch {
    throw new Error('COMFYUI_PROBE_INVALID_JSON')
  }
  const record = asRecord(payload) || {}
  const queueSize = Object.entries(record)
    .filter(([key]) => key.endsWith('_queue_size'))
    .reduce((total, [, value]) => (
      typeof value === 'number' && Number.isFinite(value) ? total + value : total
    ), 0)
  return { queueSize }
}

export type { ComfyUiOutput, ComfyUiResult, ComfyUiWorkflow }
