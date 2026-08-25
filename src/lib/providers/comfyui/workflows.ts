import imageZImageTurbo from './workflows/image_z_image_turbo.json'
import videoMinimaxH3I2v from './workflows/video_minimax_h3_i2v.json'
import videoMinimaxH3R2v from './workflows/video_minimax_h3_r2v.json'
import videoMinimaxH3T2v from './workflows/video_minimax_h3_t2v.json'
import type { ComfyUiWorkflow } from './types'

export const COMFYUI_MODEL_IDS = {
  imageZImageTurbo: 'z-image-turbo',
  videoMinimaxH3I2v: 'minimax-h3-i2v',
  videoMinimaxH3R2v: 'minimax-h3-r2v',
  videoMinimaxH3T2v: 'minimax-h3-t2v',
} as const

type ComfyUiModelId = typeof COMFYUI_MODEL_IDS[keyof typeof COMFYUI_MODEL_IDS]

function cloneWorkflow(source: unknown): ComfyUiWorkflow {
  return JSON.parse(JSON.stringify(source)) as ComfyUiWorkflow
}

function setInput(workflow: ComfyUiWorkflow, nodeId: string, input: string, value: unknown) {
  const node = workflow[nodeId]
  if (!node) throw new Error(`COMFYUI_WORKFLOW_NODE_MISSING: ${nodeId}`)
  node.inputs[input] = value
}

function randomSeed(): number {
  return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
}

function parseSize(size: string | undefined): { width: number; height: number } | null {
  const match = typeof size === 'string' ? size.trim().match(/^(\d+)x(\d+)$/i) : null
  if (!match) return null
  const normalize = (raw: string) => {
    const value = Math.max(256, Math.min(2048, Number.parseInt(raw, 10)))
    return Math.max(256, Math.round(value / 64) * 64)
  }
  return { width: normalize(match[1]), height: normalize(match[2]) }
}

function resolveImageSize(aspectRatio?: string, size?: string): { width: number; height: number } {
  const explicit = parseSize(size)
  if (explicit) return explicit

  const sizes: Record<string, { width: number; height: number }> = {
    '1:1': { width: 1024, height: 1024 },
    '16:9': { width: 1344, height: 768 },
    '9:16': { width: 768, height: 1344 },
    '4:3': { width: 1152, height: 896 },
    '3:4': { width: 896, height: 1152 },
    '3:2': { width: 1216, height: 832 },
    '2:3': { width: 832, height: 1216 },
    '21:9': { width: 1536, height: 640 },
  }
  return sizes[aspectRatio || '1:1'] || sizes['1:1']
}

function toResolutionSelectorValue(aspectRatio?: string): string {
  const values: Record<string, string> = {
    '1:1': '1:1 (Square)',
    '16:9': '16:9 (Widescreen)',
    '9:16': '9:16 (Portrait Widescreen)',
    '4:3': '4:3 (Standard)',
    '3:4': '3:4 (Portrait Standard)',
    '3:2': '3:2 (Photo)',
    '2:3': '2:3 (Portrait Photo)',
    '21:9': '21:9 (Ultrawide)',
  }
  return values[aspectRatio || '16:9'] || values['16:9']
}

function setReferenceImages(
  workflow: ComfyUiWorkflow,
  imageUrls: string[],
) {
  const slots = [
    { input: 'ref_images.ref_image_0', nodeId: '137' },
    { input: 'ref_images.ref_image_1', nodeId: '139' },
    { input: 'ref_images.ref_image_2', nodeId: '141' },
    { input: 'ref_images.ref_image_3', nodeId: '142' },
    { input: 'ref_images.ref_image_4', nodeId: '143' },
  ]
  const target = workflow['136']
  if (!target) throw new Error('COMFYUI_WORKFLOW_NODE_MISSING: 136')

  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index]
    const image = imageUrls[index]
    if (image) {
      setInput(workflow, slot.nodeId, 'image', image)
      target.inputs[slot.input] = [slot.nodeId, 0]
    } else {
      delete target.inputs[slot.input]
      delete workflow[slot.nodeId]
    }
  }
}

export function buildComfyUiImageWorkflow(params: {
  modelId: string
  prompt: string
  aspectRatio?: string
  size?: string
  seed?: number
}): ComfyUiWorkflow {
  if (params.modelId !== COMFYUI_MODEL_IDS.imageZImageTurbo) {
    throw new Error(`COMFYUI_IMAGE_MODEL_UNSUPPORTED: ${params.modelId}`)
  }
  const workflow = cloneWorkflow(imageZImageTurbo)
  const { width, height } = resolveImageSize(params.aspectRatio, params.size)
  setInput(workflow, '57:27', 'text', params.prompt)
  setInput(workflow, '57:13', 'width', width)
  setInput(workflow, '57:13', 'height', height)
  setInput(workflow, '57:3', 'seed', params.seed ?? randomSeed())
  return workflow
}

export function buildComfyUiVideoWorkflow(params: {
  modelId: ComfyUiModelId | string
  prompt: string
  imageUrl?: string
  referenceImages?: string[]
  referenceVideoUrl?: string
  aspectRatio?: string
  duration?: number
  fps?: number
  seed?: number
}): ComfyUiWorkflow {
  const duration = Math.max(1, Math.min(30, params.duration ?? 5))
  const fps = Math.max(1, Math.min(120, params.fps ?? 24))
  const aspectRatio = toResolutionSelectorValue(params.aspectRatio)
  const seed = params.seed ?? randomSeed()

  if (params.modelId === COMFYUI_MODEL_IDS.videoMinimaxH3I2v) {
    if (!params.imageUrl) throw new Error('COMFYUI_I2V_IMAGE_REQUIRED')
    const workflow = cloneWorkflow(videoMinimaxH3I2v)
    setInput(workflow, '114', 'image', params.imageUrl)
    setInput(workflow, '115', 'aspect_ratio', aspectRatio)
    setInput(workflow, '105:104', 'prompt', params.prompt)
    setInput(workflow, '105:111', 'value', duration)
    setInput(workflow, '105:91', 'fps', fps)
    setInput(workflow, '105:15', 'noise_seed', seed)
    return workflow
  }

  if (params.modelId === COMFYUI_MODEL_IDS.videoMinimaxH3T2v) {
    const workflow = cloneWorkflow(videoMinimaxH3T2v)
    setInput(workflow, '115', 'aspect_ratio', aspectRatio)
    setInput(workflow, '105:104', 'prompt', params.prompt)
    setInput(workflow, '105:111', 'value', duration)
    setInput(workflow, '105:91', 'fps', fps)
    setInput(workflow, '105:15', 'noise_seed', seed)
    return workflow
  }

  if (params.modelId === COMFYUI_MODEL_IDS.videoMinimaxH3R2v) {
    const images = [params.imageUrl, ...(params.referenceImages || [])]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .slice(0, 5)
    if (images.length === 0 && !params.referenceVideoUrl) {
      throw new Error('COMFYUI_R2V_REFERENCE_REQUIRED')
    }

    const workflow = cloneWorkflow(videoMinimaxH3R2v)
    setInput(workflow, '115', 'aspect_ratio', aspectRatio)
    setInput(workflow, '138', 'value', params.prompt)
    setInput(workflow, '132', 'value', duration)
    setInput(workflow, '130', 'fps', fps)
    setInput(workflow, '129', 'noise_seed', seed)
    setReferenceImages(workflow, images)

    if (params.referenceVideoUrl) {
      setInput(workflow, '148', 'file', params.referenceVideoUrl)
    } else {
      delete workflow['136'].inputs['ref_videos.ref_video_0']
      delete workflow['148']
      delete workflow['149']
    }
    return workflow
  }

  throw new Error(`COMFYUI_VIDEO_MODEL_UNSUPPORTED: ${params.modelId}`)
}
