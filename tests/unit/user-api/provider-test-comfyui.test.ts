import { beforeEach, describe, expect, it, vi } from 'vitest'
import { testProviderConnection } from '@/lib/user-api/provider-test'

describe('ComfyUI provider connection test', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('probes queue-info with the configured token', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      preprocess_queue_size: 1,
      generation_queue_size: 2,
      postprocess_queue_size: 0,
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await testProviderConnection({
      apiType: 'comfyui',
      baseUrl: 'https://comfy.example/docs',
      apiKey: 'token-1',
    })

    expect(result).toEqual({
      success: true,
      steps: [{
        name: 'models',
        status: 'pass',
        message: 'ComfyUI queue reachable (3 queued)',
      }],
    })
    const url = new URL(String((fetchMock.mock.calls as unknown[][])[0][0]))
    expect(url.pathname).toBe('/queue-info')
    expect(url.searchParams.get('token')).toBe('token-1')
  })

  it('returns the ComfyUI transport cause in a failed connection test', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw Object.assign(new TypeError('fetch failed'), {
        cause: new Error('Client network socket disconnected before secure TLS connection was established'),
      })
    }))

    const result = await testProviderConnection({
      apiType: 'comfyui',
      baseUrl: 'https://comfy.example',
      apiKey: 'token-1',
    })

    expect(result).toEqual({
      success: false,
      steps: [{
        name: 'models',
        status: 'fail',
        message: 'fetch failed; cause: Client network socket disconnected before secure TLS connection was established',
      }],
    })
  })
})
