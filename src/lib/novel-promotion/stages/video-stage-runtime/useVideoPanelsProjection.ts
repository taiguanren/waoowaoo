'use client'

import { useMemo } from 'react'
import type {
  Clip,
  Storyboard,
  VideoPanel,
} from '@/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/video'

interface TaskStateLike {
  phase?: string | null
  lastError?: { code?: string; message?: string } | null
  updatedAt?: string | null
}

interface TaskPresentationLike {
  getTaskState: (key: string) => TaskStateLike | null
}

interface UseVideoPanelsProjectionParams {
  storyboards: Storyboard[]
  clips: Clip[]
  panelVideoStates: TaskPresentationLike
  panelLipStates: TaskPresentationLike
}

function toTimestamp(value: string | Date | null | undefined) {
  if (!value) return null
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

function outputSupersedesFailedTask(
  outputUrl: string | null | undefined,
  outputUpdatedAt: string | Date | null | undefined,
  taskState: TaskStateLike | null,
) {
  if (!outputUrl || taskState?.phase !== 'failed') return false
  const outputTimestamp = toTimestamp(outputUpdatedAt)
  const taskTimestamp = toTimestamp(taskState.updatedAt)
  return outputTimestamp !== null && taskTimestamp !== null && outputTimestamp > taskTimestamp
}

export function useVideoPanelsProjection({
  storyboards,
  clips,
  panelVideoStates,
  panelLipStates,
}: UseVideoPanelsProjectionParams) {
  const sortedStoryboards = useMemo(() => {
    return [...storyboards].sort((left, right) => {
      const leftIndex = clips.findIndex((clip) => clip.id === left.clipId)
      const rightIndex = clips.findIndex((clip) => clip.id === right.clipId)
      return leftIndex - rightIndex
    })
  }, [clips, storyboards])

  const allPanels = useMemo<VideoPanel[]>(() => {
    const panels: VideoPanel[] = []
    sortedStoryboards.forEach((storyboard) => {
      const storyboardPanels = storyboard.panels || []
      storyboardPanels.forEach((panel, index) => {
        const actualPanelIndex = panel.panelIndex ?? index
        let charactersArray: string[] = []
        if (panel.characters) {
          try {
            const parsed = typeof panel.characters === 'string' ? JSON.parse(panel.characters) : panel.characters
            charactersArray = Array.isArray(parsed) ? parsed : []
          } catch {
            charactersArray = []
          }
        }

        const panelId = panel.id
        const panelVideoState = panelId ? panelVideoStates.getTaskState(`panel-video:${panelId}`) : null
        const panelLipState = panelId ? panelLipStates.getTaskState(`panel-lip:${panelId}`) : null
        const videoErrorSuperseded =
          panelVideoState?.phase === 'completed' ||
          outputSupersedesFailedTask(panel.videoUrl, panel.updatedAt, panelVideoState)
        const lipSyncErrorSuperseded =
          panelLipState?.phase === 'completed' ||
          outputSupersedesFailedTask(panel.lipSyncVideoUrl, panel.updatedAt, panelLipState)

        panels.push({
          panelId,
          storyboardId: storyboard.id,
          panelIndex: actualPanelIndex,
          textPanel: {
            panel_number: panel.panelNumber || actualPanelIndex + 1,
            shot_type: panel.shotType || '',
            camera_move: panel.cameraMove || '',
            description: panel.description || '',
            characters: charactersArray,
            location: panel.location || '',
            text_segment: panel.srtSegment || '',
            duration: panel.duration || undefined,
            imagePrompt: panel.imagePrompt || undefined,
            video_prompt: panel.videoPrompt || undefined,
            videoModel: panel.videoModel || undefined,
          },
          imageUrl: panel.imageUrl || undefined,
          firstLastFramePrompt: panel.firstLastFramePrompt || undefined,
          videoUrl: panel.videoUrl || undefined,
          videoGenerationMode: panel.videoGenerationMode || undefined,
          videoTaskRunning: panelVideoState?.phase === 'queued' || panelVideoState?.phase === 'processing',
          videoErrorCode:
            videoErrorSuperseded
              ? undefined
              : panelVideoState?.phase === 'failed'
              ? panelVideoState.lastError?.code || panel.videoErrorCode || undefined
              : panel.videoErrorCode || undefined,
          videoErrorMessage:
            videoErrorSuperseded
              ? undefined
              : panelVideoState?.phase === 'failed'
              ? panelVideoState.lastError?.message || panel.videoErrorMessage || undefined
              : panel.videoErrorMessage || undefined,
          videoModel: panel.videoModel || undefined,
          linkedToNextPanel: panel.linkedToNextPanel || false,
          lipSyncVideoUrl: panel.lipSyncVideoUrl || undefined,
          lipSyncTaskRunning: panelLipState?.phase === 'queued' || panelLipState?.phase === 'processing',
          lipSyncErrorCode:
            lipSyncErrorSuperseded
              ? undefined
              : panelLipState?.phase === 'failed'
              ? panelLipState.lastError?.code || panel.lipSyncErrorCode || undefined
              : panel.lipSyncErrorCode || undefined,
          lipSyncErrorMessage:
            lipSyncErrorSuperseded
              ? undefined
              : panelLipState?.phase === 'failed'
              ? panelLipState.lastError?.message || panel.lipSyncErrorMessage || undefined
              : panel.lipSyncErrorMessage || undefined,
        })
      })
    })
    return panels
  }, [panelLipStates, panelVideoStates, sortedStoryboards])

  return {
    sortedStoryboards,
    allPanels,
  }
}
