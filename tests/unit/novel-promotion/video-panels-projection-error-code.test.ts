import { describe, expect, it, vi } from 'vitest'

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return {
    ...actual,
    useMemo: <T,>(factory: () => T) => factory(),
  }
})

import { useVideoPanelsProjection } from '@/lib/novel-promotion/stages/video-stage-runtime/useVideoPanelsProjection'

describe('video panels projection error code', () => {
  it('projects failed task lastError code/message onto panel fields', () => {
    const result = useVideoPanelsProjection({
      clips: [{ id: 'clip-1', start: 0, end: 5, summary: 'clip' }],
      storyboards: [{
        id: 'sb-1',
        clipId: 'clip-1',
        panels: [{
          id: 'panel-1',
          panelIndex: 0,
          description: 'panel',
        }],
      }],
      panelVideoStates: {
        getTaskState: () => ({
          phase: 'failed',
          lastError: {
            code: 'EXTERNAL_ERROR',
            message: 'upstream failed',
          },
        }),
      },
      panelLipStates: {
        getTaskState: () => null,
      },
    })

    expect(result.allPanels).toHaveLength(1)
    expect(result.allPanels[0]?.videoErrorCode).toBe('EXTERNAL_ERROR')
    expect(result.allPanels[0]?.videoErrorMessage).toBe('upstream failed')
  })

  it('drops an old failed task error after a newer video was persisted', () => {
    const result = useVideoPanelsProjection({
      clips: [{ id: 'clip-1', start: 0, end: 5, summary: 'clip' }],
      storyboards: [{
        id: 'sb-1',
        clipId: 'clip-1',
        panels: [{
          id: 'panel-1',
          panelIndex: 0,
          description: 'panel',
          videoUrl: 'images/generated.mp4',
          updatedAt: '2026-08-24T00:27:45.164Z',
        }],
      }],
      panelVideoStates: {
        getTaskState: () => ({
          phase: 'failed',
          updatedAt: '2026-08-24T00:19:17.883Z',
          lastError: {
            code: 'TASK_LOCALE_REQUIRED',
            message: 'task locale is missing',
          },
        }),
      },
      panelLipStates: {
        getTaskState: () => null,
      },
    })

    expect(result.allPanels[0]?.videoUrl).toBe('images/generated.mp4')
    expect(result.allPanels[0]?.videoErrorCode).toBeUndefined()
    expect(result.allPanels[0]?.videoErrorMessage).toBeUndefined()
  })

  it('keeps a failed regeneration error when it is newer than the existing video', () => {
    const result = useVideoPanelsProjection({
      clips: [{ id: 'clip-1', start: 0, end: 5, summary: 'clip' }],
      storyboards: [{
        id: 'sb-1',
        clipId: 'clip-1',
        panels: [{
          id: 'panel-1',
          panelIndex: 0,
          description: 'panel',
          videoUrl: 'images/existing.mp4',
          updatedAt: '2026-08-24T00:19:17.883Z',
        }],
      }],
      panelVideoStates: {
        getTaskState: () => ({
          phase: 'failed',
          updatedAt: '2026-08-24T00:27:45.164Z',
          lastError: {
            code: 'EXTERNAL_ERROR',
            message: 'regeneration failed',
          },
        }),
      },
      panelLipStates: {
        getTaskState: () => null,
      },
    })

    expect(result.allPanels[0]?.videoErrorCode).toBe('EXTERNAL_ERROR')
    expect(result.allPanels[0]?.videoErrorMessage).toBe('regeneration failed')
  })

  it('clears legacy panel errors when the latest task completed', () => {
    const result = useVideoPanelsProjection({
      clips: [{ id: 'clip-1', start: 0, end: 5, summary: 'clip' }],
      storyboards: [{
        id: 'sb-1',
        clipId: 'clip-1',
        panels: [{
          id: 'panel-1',
          panelIndex: 0,
          description: 'panel',
          videoUrl: 'images/generated.mp4',
          videoErrorCode: 'EXTERNAL_ERROR',
          videoErrorMessage: 'old failure',
        }],
      }],
      panelVideoStates: {
        getTaskState: () => ({ phase: 'completed' }),
      },
      panelLipStates: {
        getTaskState: () => null,
      },
    })

    expect(result.allPanels[0]?.videoErrorCode).toBeUndefined()
    expect(result.allPanels[0]?.videoErrorMessage).toBeUndefined()
  })
})
