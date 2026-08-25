'use client'

import { useCallback, useMemo } from 'react'
import { useTaskList } from '@/lib/query/hooks/useTaskStatus'
import { resolveErrorDisplay } from '@/lib/errors/display'
import { useDismissFailedTasks } from '@/lib/query/mutations/task-mutations'

interface UseStoryboardGroupTaskErrorsParams {
  projectId: string
  episodeId: string
}

/**
 * 从数据库查询 panel 级别的 failed tasks，并提供 dismiss 能力。
 * dismiss 通过 API 将 task 状态改为 'dismissed'，数据库为唯一来源。
 */
export function useStoryboardGroupTaskErrors({
  projectId,
}: UseStoryboardGroupTaskErrorsParams) {
  const panelFailedTasksQuery = useTaskList({
    projectId,
    targetType: 'NovelPromotionPanel',
    type: ['image_panel', 'panel_variant', 'modify_asset_image'],
    // Load the complete recent terminal/active history so an older failed
    // task cannot mask a newer completed generation for the same panel.
    statuses: ['queued', 'processing', 'completed', 'failed', 'canceled'],
    limit: 200,
    enabled: !!projectId,
  })

  const dismissMutation = useDismissFailedTasks(projectId)

  const panelTaskErrorMap = useMemo(() => {
    const map = new Map<string, { taskId: string; message: string }>()
    const seenTargets = new Set<string>()
    for (const task of panelFailedTasksQuery.data || []) {
      // queryTasks is ordered newest-first. The first task per panel is the
      // current state; only expose an error when that current task failed.
      if (seenTargets.has(task.targetId)) continue
      seenTargets.add(task.targetId)
      if (task.status !== 'failed') continue
      const display = resolveErrorDisplay(task.error || null)
      if (!display) continue
      map.set(task.targetId, { taskId: task.id, message: display.message })
    }
    return map
  }, [panelFailedTasksQuery.data])

  const clearPanelTaskError = useCallback((panelId: string) => {
    const taskIds = (panelFailedTasksQuery.data || [])
      .filter((task) => task.targetId === panelId && task.status === 'failed')
      .map((task) => task.id)
    if (taskIds.length === 0) return
    dismissMutation.mutate(taskIds)
  }, [dismissMutation, panelFailedTasksQuery.data])

  return {
    panelTaskErrorMap,
    clearPanelTaskError,
  }
}
