import { describe, expect, it } from 'vitest'
import { replaceModelKeyInDefaults } from '@/lib/api-config/model-defaults'

describe('replaceModelKeyInDefaults', () => {
  it('moves the analysis default when an explicitly configured model is renamed', () => {
    const previous = {
      analysisModel: 'openai-compatible:gateway::grok-4.5',
      characterModel: 'fal::character-model',
    }

    expect(replaceModelKeyInDefaults(
      previous,
      'openai-compatible:gateway::grok-4.5',
      'openai-compatible:gateway::grok-4.6',
    )).toEqual({
      analysisModel: 'openai-compatible:gateway::grok-4.6',
      characterModel: 'fal::character-model',
    })
  })

  it('updates every pipeline default that points to the renamed key', () => {
    const previous = {
      analysisModel: 'openai-compatible:gateway::grok-4.5',
      storyboardModel: 'openai-compatible:gateway::grok-4.5',
    }

    expect(replaceModelKeyInDefaults(
      previous,
      'openai-compatible:gateway::grok-4.5',
      'openai-compatible:gateway::grok-4.6',
    )).toMatchObject({
      analysisModel: 'openai-compatible:gateway::grok-4.6',
      storyboardModel: 'openai-compatible:gateway::grok-4.6',
    })
  })

  it('keeps the same object when no default references the old key', () => {
    const previous = { analysisModel: 'openai-compatible:gateway::other' }
    expect(replaceModelKeyInDefaults(
      previous,
      'openai-compatible:gateway::grok-4.5',
      'openai-compatible:gateway::grok-4.6',
    )).toBe(previous)
  })
})
