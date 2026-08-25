import { describe, expect, it } from 'vitest'
import { createAudioGenerator, createImageGenerator, createVideoGenerator } from '@/lib/generators/factory'
import { GoogleVeoVideoGenerator } from '@/lib/generators/video/google'
import { BailianAudioGenerator, BailianImageGenerator, BailianVideoGenerator, SiliconFlowAudioGenerator } from '@/lib/generators/official'
import { ComfyUiImageGenerator, ComfyUiVideoGenerator } from '@/lib/providers/comfyui'

describe('generator factory', () => {
  it('routes gemini-compatible video provider to Google video generator', () => {
    const generator = createVideoGenerator('gemini-compatible:gm-1')
    expect(generator).toBeInstanceOf(GoogleVeoVideoGenerator)
  })

  it('routes bailian official providers to official generators', () => {
    expect(createImageGenerator('bailian')).toBeInstanceOf(BailianImageGenerator)
    expect(createVideoGenerator('bailian')).toBeInstanceOf(BailianVideoGenerator)
    expect(createAudioGenerator('bailian')).toBeInstanceOf(BailianAudioGenerator)
  })

  it('routes siliconflow audio provider to official generator', () => {
    expect(createAudioGenerator('siliconflow')).toBeInstanceOf(SiliconFlowAudioGenerator)
  })

  it('routes ComfyUI image and video models to the workflow generators', () => {
    expect(createImageGenerator('comfyui', 'z-image-turbo')).toBeInstanceOf(ComfyUiImageGenerator)
    expect(createVideoGenerator('comfyui')).toBeInstanceOf(ComfyUiVideoGenerator)
  })
})
