import OpenAI, { toFile } from 'openai'
import { getProviderConfig } from '@/lib/api-config'
import { getInternalBaseUrl } from '@/lib/env'
import { getImageBase64Cached } from '@/lib/image-cache'
import type { OpenAICompatClientConfig } from '../types'

const DEFAULT_RESPONSES_TIMEOUT_MS = 90_000

export function getOpenAICompatResponsesTimeoutMs(): number {
  const raw = Number.parseInt(process.env.OPENAI_COMPAT_RESPONSES_TIMEOUT_MS || '', 10)
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_RESPONSES_TIMEOUT_MS
  return Math.max(10_000, Math.min(raw, 300_000))
}

export function shouldFallbackFromOpenAICompatResponses(error: unknown): boolean {
  const record = error && typeof error === 'object' ? error as Record<string, unknown> : null
  const status = typeof record?.status === 'number' ? record.status : undefined
  if (typeof status === 'number') return status >= 500

  const message = error instanceof Error
    ? error.message.toLowerCase()
    : String(error).toLowerCase()
  return message.includes('timeout')
    || message.includes('aborted')
    || message.includes('524')
    || message.includes('502')
    || message.includes('503')
    || message.includes('504')
}

function toAbsoluteUrlIfNeeded(value: string): string {
  if (!value.startsWith('/')) return value
  const baseUrl = getInternalBaseUrl()
  return `${baseUrl}${value}`
}

export function parseDataUrl(value: string): { mimeType: string; base64: string } | null {
  const marker = ';base64,'
  const markerIndex = value.indexOf(marker)
  if (!value.startsWith('data:') || markerIndex === -1) return null
  const mimeType = value.slice(5, markerIndex)
  const base64 = value.slice(markerIndex + marker.length)
  if (!mimeType || !base64) return null
  return { mimeType, base64 }
}

export function readStringOption(value: unknown, optionName: string): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') {
    throw new Error(`OPENAI_COMPAT_OPTION_INVALID: ${optionName}`)
  }
  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error(`OPENAI_COMPAT_OPTION_INVALID: ${optionName}`)
  }
  return trimmed
}

export async function resolveOpenAICompatClientConfig(userId: string, providerId: string): Promise<OpenAICompatClientConfig> {
  const config = await getProviderConfig(userId, providerId)
  if (!config.baseUrl) {
    throw new Error(`PROVIDER_BASE_URL_MISSING: ${config.id}`)
  }
  return {
    providerId: config.id,
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
  }
}

export function createOpenAICompatClient(config: OpenAICompatClientConfig): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  })
}

export async function toUploadFile(imageSource: string, index: number): Promise<File> {
  const parsedDataUrl = parseDataUrl(imageSource)
  if (parsedDataUrl) {
    const bytes = Buffer.from(parsedDataUrl.base64, 'base64')
    return await toFile(bytes, `reference-${index}.png`, { type: parsedDataUrl.mimeType })
  }

  if (imageSource.startsWith('http://') || imageSource.startsWith('https://') || imageSource.startsWith('/')) {
    const cachedDataUrl = await getImageBase64Cached(toAbsoluteUrlIfNeeded(imageSource))
    const parsedCached = parseDataUrl(cachedDataUrl)
    if (!parsedCached) {
      throw new Error(`OPENAI_COMPAT_REFERENCE_INVALID: failed to parse image source ${index}`)
    }
    const bytes = Buffer.from(parsedCached.base64, 'base64')
    return await toFile(bytes, `reference-${index}.png`, { type: parsedCached.mimeType })
  }

  const bytes = Buffer.from(imageSource, 'base64')
  return await toFile(bytes, `reference-${index}.png`, { type: 'image/png' })
}
