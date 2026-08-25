import { describe, expect, it, vi } from 'vitest'
import {
  buildComfyUiImageWorkflow,
  buildComfyUiUrl,
  buildComfyUiVideoWorkflow,
  COMFYUI_MODEL_IDS,
  extractComfyUiOutputDataUrl,
  prepareComfyUiMediaUrl,
  probeComfyUiConnection,
  queryComfyUiResult,
  submitComfyUiWorkflow,
} from '@/lib/providers/comfyui'

describe('ComfyUI provider adapter', () => {
  it('builds authenticated API URLs from the docs URL', () => {
    const url = new URL(buildComfyUiUrl(
      'https://comfy.example/docs?token=old',
      '/queue-info',
      'new-token',
    ))

    expect(url.pathname).toBe('/queue-info')
    expect(url.searchParams.get('token')).toBe('new-token')
  })

  it('maps image prompt, size and seed into the Z-Image workflow', () => {
    const workflow = buildComfyUiImageWorkflow({
      modelId: COMFYUI_MODEL_IDS.imageZImageTurbo,
      prompt: 'new prompt',
      aspectRatio: '16:9',
      seed: 123,
    })

    expect(workflow['57:27'].inputs.text).toBe('new prompt')
    expect(workflow['57:13'].inputs).toMatchObject({ width: 1344, height: 768 })
    expect(workflow['57:3'].inputs.seed).toBe(123)
    expect(workflow['57:28'].inputs.unet_name).toBe('z_image_turbo_int8_convrot.safetensors')
    expect(workflow['57:30'].inputs.clip_name).toBe('qwen_3_4b_fp8_mixed.safetensors')
  })

  it('maps first frame, prompt and duration into the H3 I2V workflow', () => {
    const workflow = buildComfyUiVideoWorkflow({
      modelId: COMFYUI_MODEL_IDS.videoMinimaxH3I2v,
      prompt: 'animate product',
      imageUrl: 'https://media.example/first.png',
      aspectRatio: '9:16',
      duration: 10,
      fps: 24,
      seed: 456,
    })

    expect(workflow['114'].inputs.image).toBe('https://media.example/first.png')
    expect(workflow['115'].inputs.aspect_ratio).toBe('9:16 (Portrait Widescreen)')
    expect(workflow['105:104'].inputs.prompt).toBe('animate product')
    expect(workflow['105:111'].inputs.value).toBe(10)
    expect(workflow['105:91'].inputs.fps).toBe(24)
    expect(workflow['105:15'].inputs.noise_seed).toBe(456)
  })

  it('removes unused R2V media slots while retaining supplied references', () => {
    const workflow = buildComfyUiVideoWorkflow({
      modelId: COMFYUI_MODEL_IDS.videoMinimaxH3R2v,
      prompt: 'keep identity',
      imageUrl: 'https://media.example/first.png',
      referenceImages: ['https://media.example/second.png'],
      duration: 5,
      fps: 24,
    })

    expect(workflow['137'].inputs.image).toBe('https://media.example/first.png')
    expect(workflow['139'].inputs.image).toBe('https://media.example/second.png')
    expect(workflow['136'].inputs['ref_images.ref_image_0']).toEqual(['137', 0])
    expect(workflow['136'].inputs['ref_images.ref_image_1']).toEqual(['139', 0])
    expect(workflow['130'].inputs.fps).toBe(24)
    expect(workflow['136'].inputs['ref_videos.ref_video_0']).toBeUndefined()
    expect(workflow['148']).toBeUndefined()
    expect(workflow['149']).toBeUndefined()
  })

  it('maps T2V without requiring an image input', () => {
    const workflow = buildComfyUiVideoWorkflow({
      modelId: COMFYUI_MODEL_IDS.videoMinimaxH3T2v,
      prompt: 'text only video',
      duration: 15,
      fps: 24,
      seed: 789,
    })

    expect(workflow['105:104'].inputs.prompt).toBe('text only video')
    expect(workflow['105:111'].inputs.value).toBe(15)
    expect(workflow['105:91'].inputs.fps).toBe(24)
    expect(workflow['105:15'].inputs.noise_seed).toBe(789)
  })

  it('converts wrapper base64 output into a data URL', () => {
    expect(extractComfyUiOutputDataUrl({
      id: 'request-1',
      status: 'completed',
      output: [{
        output_type: 'images',
        data: 'AAAA',
        mimetype: 'image/png',
      }],
    }, 'image')).toBe('data:image/png;base64,AAAA')
  })

  it('keeps public media URLs for remote ComfyUI', async () => {
    await expect(prepareComfyUiMediaUrl(
      'https://media.example/input.png',
      'https://comfy.example',
    )).resolves.toBe('https://media.example/input.png')
  })

  it('preserves the transport cause when the wrapper endpoint is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw Object.assign(new TypeError('fetch failed'), {
        cause: new Error('Client network socket disconnected before secure TLS connection was established'),
      })
    }))

    await expect(probeComfyUiConnection({
      baseUrl: 'https://tunnel.example',
      apiToken: 'TOKEN',
    })).rejects.toThrow(/COMFYUI_NETWORK_ERROR: fetch failed; cause: Client network socket disconnected/)
  })

  it('submits through native ComfyUI when the wrapper endpoint is absent', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ prompt_id: 'native-request-1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(submitComfyUiWorkflow({
      baseUrl: 'https://comfy.example',
      apiToken: 'TOKEN',
      workflow: buildComfyUiImageWorkflow({
        modelId: COMFYUI_MODEL_IDS.imageZImageTurbo,
        prompt: 'native',
      }),
    })).resolves.toBe('native-request-1')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[1][0])).toContain('/prompt')
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({
      prompt: expect.any(Object),
      client_id: expect.any(String),
    })
  })

  it('polls native history and returns a view URL for saved images', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        'native-request-2': {
          status: { status_str: 'success', completed: true },
          outputs: {
            '9': { images: [{ filename: 'z-image-turbo_00001_.png', subfolder: '', type: 'output' }] },
          },
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(queryComfyUiResult({
      baseUrl: 'https://comfy.example',
      apiToken: 'TOKEN',
      requestId: 'native-request-2',
      mediaType: 'image',
    })).resolves.toMatchObject({
      status: 'completed',
      resultUrl: 'https://comfy.example/view?token=TOKEN&filename=z-image-turbo_00001_.png&subfolder=&type=output',
    })
    expect(String(fetchMock.mock.calls[1][0])).toContain('/history/native-request-2')
  })

  it('probes native ComfyUI queue when the wrapper probe endpoint is absent', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        queue_running: [['running']],
        queue_pending: [['pending-1'], ['pending-2']],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(probeComfyUiConnection({
      baseUrl: 'https://comfy.example',
      apiToken: 'TOKEN',
    })).resolves.toEqual({ queueSize: 3 })
    expect(String(fetchMock.mock.calls[1][0])).toContain('/queue')
  })

  it('rejects data and private media URLs for remote ComfyUI', async () => {
    await expect(prepareComfyUiMediaUrl(
      'data:image/png;base64,AAAA',
      'https://comfy.example',
    )).rejects.toThrow(/COMFYUI_MEDIA_URL_REQUIRED/)
    await expect(prepareComfyUiMediaUrl(
      'http://127.0.0.1:19000/input.png',
      'https://comfy.example',
    )).rejects.toThrow(/COMFYUI_MEDIA_URL_NOT_PUBLIC/)
  })

  it('uploads data-url first frames for native ComfyUI', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      name: 'waoowaoo-upload.png',
      subfolder: '',
      type: 'input',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(prepareComfyUiMediaUrl(
      'data:image/png;base64,AAAA',
      'https://comfy.example',
      'TOKEN',
    )).resolves.toBe('waoowaoo-upload.png')
    const firstCall = (fetchMock.mock.calls as unknown[][])[0]
    expect(String(firstCall[0])).toContain('/upload/image?token=TOKEN')
    expect(firstCall[1]).toMatchObject({ method: 'POST' })
  })
})
