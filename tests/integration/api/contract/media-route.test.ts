import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildMockRequest } from '../../../helpers/request'

const mediaMock = vi.hoisted(() => ({
  getMediaObjectByPublicId: vi.fn(async () => ({
    id: 'media-1',
    publicId: 'public-1',
    storageKey: 'images/generated.jpg',
    sha256: null,
    mimeType: 'image/jpeg',
    sizeBytes: 4,
    width: 2,
    height: 2,
    durationMs: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
  })),
}))

const storageMock = vi.hoisted(() => ({
  getSignedObjectUrl: vi.fn(async () => 'http://minio.example/signed/generated.jpg'),
}))

vi.mock('@/lib/media/service', () => mediaMock)
vi.mock('@/lib/storage', () => storageMock)

describe('stable media route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches storage directly instead of routing through the configured internal app port', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(Buffer.from('test'), {
      status: 200,
      headers: { 'content-type': 'image/jpeg', 'content-length': '4' },
    })))

    const mod = await import('@/app/m/[publicId]/route')
    const request = buildMockRequest({
      path: '/m/public-1',
      method: 'GET',
    })
    const response = await mod.GET(request, { params: Promise.resolve({ publicId: 'public-1' }) })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/jpeg')
    expect(await response.text()).toBe('test')
    expect(storageMock.getSignedObjectUrl).toHaveBeenCalledWith('images/generated.jpg', 3600)
    expect(fetch).toHaveBeenCalledWith('http://minio.example/signed/generated.jpg', { headers: undefined })
  })
})
