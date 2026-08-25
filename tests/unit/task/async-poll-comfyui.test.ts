import { beforeEach, describe, expect, it, vi } from 'vitest'

const getProviderConfigMock = vi.hoisted(() => vi.fn(async () => ({
  id: 'comfyui',
  name: 'ComfyUI',
  apiKey: 'api-token',
  baseUrl: 'https://comfy.example',
})))

vi.mock('@/lib/api-config', () => ({
  getProviderConfig: getProviderConfigMock,
  getUserModels: vi.fn(),
}))

vi.mock('@/lib/async-submit', () => ({ queryFalStatus: vi.fn() }))
vi.mock('@/lib/async-task-utils', () => ({
  queryGeminiBatchStatus: vi.fn(),
  queryGoogleVideoStatus: vi.fn(),
  querySeedanceVideoStatus: vi.fn(),
}))

import { pollAsyncTask } from '@/lib/async-poll'

describe('ComfyUI async polling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a completed image data URL', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      id: 'request-1',
      status: 'completed',
      output: [{ output_type: 'images', mimetype: 'image/png', data: 'AAAA' }],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await pollAsyncTask('COMFYUI:IMAGE:request-1', 'user-1')

    expect(getProviderConfigMock).toHaveBeenCalledWith('user-1', 'comfyui')
    const requestedUrl = new URL(String((fetchMock.mock.calls as unknown[][])[0][0]))
    expect(requestedUrl.pathname).toBe('/result/request-1')
    expect(requestedUrl.searchParams.get('token')).toBe('api-token')
    expect(result).toEqual({
      status: 'completed',
      resultUrl: 'data:image/png;base64,AAAA',
      imageUrl: 'data:image/png;base64,AAAA',
    })
  })

  it('keeps processing video tasks pending', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      id: 'request-2',
      status: 'processing',
      output: [],
    }), { status: 200 })))

    await expect(pollAsyncTask('COMFYUI:VIDEO:request-2', 'user-1'))
      .resolves.toEqual({ status: 'pending' })
  })
})
