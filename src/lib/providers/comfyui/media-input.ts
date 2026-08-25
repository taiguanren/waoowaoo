import { normalizeToOriginalMediaUrl } from '@/lib/media/outbound-image'

function isPrivateHostname(hostname: string): boolean {
  const value = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '')
  if (!value) return true
  if (value === 'localhost' || value === '::1' || value.endsWith('.localhost')) return true

  const parts = value.split('.').map((part) => Number.parseInt(part, 10))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false
  }
  const [first, second] = parts
  return first === 0
    || first === 10
    || first === 127
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
}

function readHostname(value: string): string {
  try {
    return new URL(value).hostname
  } catch {
    return ''
  }
}

function parseDataUrl(value: string): { mimeType: string; bytes: Buffer; extension: string } | null {
  const match = value.match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/)
  if (!match) return null
  const mimeType = match[1] || 'application/octet-stream'
  const payload = match[3] || ''
  const bytes = match[2]
    ? Buffer.from(payload, 'base64')
    : Buffer.from(decodeURIComponent(payload), 'utf8')
  const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1] || 'bin'
  return { mimeType, bytes, extension }
}

async function uploadNativeComfyUiImage(
  dataUrl: string,
  comfyUiBaseUrl: string,
  apiToken: string,
): Promise<string | null> {
  const parsed = parseDataUrl(dataUrl)
  if (!parsed || !parsed.mimeType.startsWith('image/')) return null

  const url = new URL('/upload/image', comfyUiBaseUrl)
  url.searchParams.set('token', apiToken)
  const form = new FormData()
  const filename = `waoowaoo-${crypto.randomUUID()}.${parsed.extension}`
  form.append('image', new Blob([new Uint8Array(parsed.bytes)], { type: parsed.mimeType }), filename)
  form.append('overwrite', 'true')

  const response = await fetch(url, {
    method: 'POST',
    body: form,
    cache: 'no-store',
    signal: AbortSignal.timeout(30_000),
  })
  if (response.status === 404 || response.status === 405) return null
  if (!response.ok) {
    throw new Error(`COMFYUI_MEDIA_UPLOAD_FAILED: ${response.status}`)
  }
  const payload = await response.json() as { name?: unknown; subfolder?: unknown }
  const name = typeof payload.name === 'string' ? payload.name.trim() : ''
  const subfolder = typeof payload.subfolder === 'string' ? payload.subfolder.trim() : ''
  if (!name) throw new Error('COMFYUI_MEDIA_UPLOAD_RESPONSE_INVALID')
  return subfolder ? `${subfolder}/${name}` : name
}

export async function prepareComfyUiMediaUrl(
  input: string,
  comfyUiBaseUrl: string,
  apiToken = '',
): Promise<string> {
  const mediaUrl = await normalizeToOriginalMediaUrl(input)
  if (mediaUrl.startsWith('data:')) {
    if (apiToken) {
      const uploadedName = await uploadNativeComfyUiImage(mediaUrl, comfyUiBaseUrl, apiToken)
      if (uploadedName) return uploadedName
    }
    throw new Error('COMFYUI_MEDIA_URL_REQUIRED: data URLs are not supported by the wrapper')
  }
  if (!mediaUrl.startsWith('http://') && !mediaUrl.startsWith('https://')) {
    throw new Error('COMFYUI_MEDIA_URL_REQUIRED: expected an HTTP(S) media URL')
  }

  const comfyUiIsPrivate = isPrivateHostname(readHostname(comfyUiBaseUrl))
  const mediaIsPrivate = isPrivateHostname(readHostname(mediaUrl))
  if (!comfyUiIsPrivate && mediaIsPrivate) {
    throw new Error('COMFYUI_MEDIA_URL_NOT_PUBLIC: remote ComfyUI cannot fetch local or private media URLs')
  }
  return mediaUrl
}
