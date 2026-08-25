import { getProviderConfig } from '@/lib/api-config'
import {
  BaseImageGenerator,
  BaseVideoGenerator,
  type GenerateResult,
  type ImageGenerateParams,
  type VideoGenerateParams,
} from '@/lib/generators/base'
import { submitComfyUiWorkflow } from './client'
import { buildComfyUiImageWorkflow, buildComfyUiVideoWorkflow } from './workflows'
import { prepareComfyUiMediaUrl } from './media-input'

const COMFYUI_PROVIDER_ID = 'comfyui'

function encodeExternalId(type: 'IMAGE' | 'VIDEO', requestId: string): string {
  return `COMFYUI:${type}:${requestId}`
}

export class ComfyUiImageGenerator extends BaseImageGenerator {
  protected async doGenerate(params: ImageGenerateParams): Promise<GenerateResult> {
    const { userId, prompt, options = {} } = params
    const provider = await getProviderConfig(userId, COMFYUI_PROVIDER_ID)
    if (!provider.baseUrl) throw new Error('COMFYUI_BASE_URL_MISSING')

    const modelId = typeof options.modelId === 'string' ? options.modelId : ''
    const workflow = buildComfyUiImageWorkflow({
      modelId,
      prompt,
      aspectRatio: typeof options.aspectRatio === 'string' ? options.aspectRatio : undefined,
      size: typeof options.size === 'string' ? options.size : undefined,
      seed: typeof options.seed === 'number' ? options.seed : undefined,
    })
    const requestId = await submitComfyUiWorkflow({
      baseUrl: provider.baseUrl,
      apiToken: provider.apiKey,
      workflow,
    })
    return {
      success: true,
      async: true,
      requestId,
      externalId: encodeExternalId('IMAGE', requestId),
    }
  }
}

export class ComfyUiVideoGenerator extends BaseVideoGenerator {
  protected async doGenerate(params: VideoGenerateParams): Promise<GenerateResult> {
    const { userId, imageUrl, prompt = '', options = {} } = params
    const provider = await getProviderConfig(userId, COMFYUI_PROVIDER_ID)
    if (!provider.baseUrl) throw new Error('COMFYUI_BASE_URL_MISSING')

    const modelId = typeof options.modelId === 'string' ? options.modelId : ''
    const normalizedImageUrl = imageUrl
      ? await prepareComfyUiMediaUrl(imageUrl, provider.baseUrl, provider.apiKey)
      : undefined
    const referenceImages = Array.isArray(options.referenceImages)
      ? await Promise.all(options.referenceImages
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map((value) => prepareComfyUiMediaUrl(value, provider.baseUrl!, provider.apiKey)))
      : undefined
    const normalizedReferenceVideoUrl = typeof options.referenceVideoUrl === 'string' && options.referenceVideoUrl.trim()
      ? await prepareComfyUiMediaUrl(options.referenceVideoUrl, provider.baseUrl, provider.apiKey)
      : undefined
    const workflow = buildComfyUiVideoWorkflow({
      modelId,
      prompt,
      imageUrl: normalizedImageUrl,
      referenceImages,
      referenceVideoUrl: normalizedReferenceVideoUrl,
      aspectRatio: typeof options.aspectRatio === 'string' ? options.aspectRatio : undefined,
      duration: typeof options.duration === 'number' ? options.duration : undefined,
      fps: typeof options.fps === 'number' ? options.fps : undefined,
      seed: typeof options.seed === 'number' ? options.seed : undefined,
    })
    const requestId = await submitComfyUiWorkflow({
      baseUrl: provider.baseUrl,
      apiToken: provider.apiKey,
      workflow,
    })
    return {
      success: true,
      async: true,
      requestId,
      externalId: encodeExternalId('VIDEO', requestId),
    }
  }
}
