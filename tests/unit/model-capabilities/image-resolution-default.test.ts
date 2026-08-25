import { describe, expect, it } from 'vitest'
import {
  type CapabilitySelections,
  type ModelCapabilities,
  type UnifiedModelType,
} from '@/lib/model-config-contract'
import { resolveGenerationOptionsForModel } from '@/lib/model-capabilities/lookup'

describe('model-capabilities/lookup - image resolution defaulting', () => {
  const modelType: UnifiedModelType = 'image'
  const modelKey = 'google::test-image-model'

  const capabilities: ModelCapabilities = {
    image: {
      resolutionOptions: ['0.5K', '1K', '2K'],
    },
  }

  it('auto-fills resolution with first option when missing and required', () => {
    const capabilityDefaults: CapabilitySelections = {}

    const result = resolveGenerationOptionsForModel({
      modelType,
      modelKey,
      capabilities,
      capabilityDefaults,
      requireAllFields: true,
    })

    expect(result.issues).toEqual([])
    expect(result.options).toEqual({
      resolution: '0.5K',
    })
  })

  it('does not override user-provided resolution', () => {
    const capabilityDefaults: CapabilitySelections = {
      [modelKey]: {
        resolution: '2K',
      },
    }

    const result = resolveGenerationOptionsForModel({
      modelType,
      modelKey,
      capabilities,
      capabilityDefaults,
      requireAllFields: true,
    })

    expect(result.issues).toEqual([])
    expect(result.options).toEqual({
      resolution: '2K',
    })
  })
})

describe('model-capabilities/lookup - singleton video defaults', () => {
  it('fills a singleton fps option when an older request omits it', () => {
    const result = resolveGenerationOptionsForModel({
      modelType: 'video',
      modelKey: 'comfyui::minimax-h3-r2v',
      capabilities: {
        video: {
          generationModeOptions: ['normal'],
          durationOptions: [5, 10, 15],
          fpsOptions: [24],
        },
      },
      capabilityDefaults: {
        'comfyui::minimax-h3-r2v': { duration: 5 },
      },
      requireAllFields: true,
    })

    expect(result.issues).toEqual([])
    expect(result.options).toEqual({ generationMode: 'normal', duration: 5, fps: 24 })
  })
})

