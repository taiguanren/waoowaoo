'use client'

import { useCallback, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import NovelInputStage from './NovelInputStage'
import SmartImportWizard from './SmartImportWizard'
import { useWorkspaceStageRuntime } from '../WorkspaceStageRuntimeContext'
import { useWorkspaceEpisodeStageData } from '../hooks/useWorkspaceEpisodeStageData'
import type { SplitEpisode } from './smart-import/types'
import { useRouter } from '@/i18n/navigation'
import { queryKeys } from '@/lib/query/keys'
import { buildSmartImportCompletionQuery } from '@/lib/novel-promotion/smart-import-completion'

/**
 * 配置阶段 — 整合 NovelInputStage + 长文本智能分集
 * 
 * 当用户输入长文本（>1000字）并点击"开始创作"时，
 * 弹出引导卡片建议使用智能分集。
 * 选择"智能分集"后，直接进入 SmartImportWizard 的分析流程。
 */
export default function ConfigStage() {
  const runtime = useWorkspaceStageRuntime()
  const { episodeName, novelText } = useWorkspaceEpisodeStageData()
  const params = useParams<{ projectId: string }>()
  const projectId = params?.projectId ?? ''
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()

  // 智能分集模式
  const [smartSplitMode, setSmartSplitMode] = useState(false)
  const [smartSplitText, setSmartSplitText] = useState('')

  const handleSmartSplit = useCallback((text: string) => {
    setSmartSplitText(text)
    setSmartSplitMode(true)
  }, [])

  const handleSmartSplitComplete = useCallback(async (episodes: SplitEpisode[], triggerGlobalAnalysis = false) => {
    // 分集完成后，刷新页面以加载新的剧集数据
    // 通过 window.location.reload 简单处理，因为分集会重新创建所有剧集
    void episodes
    await queryClient.invalidateQueries({ queryKey: queryKeys.projectData(projectId) })
    if (triggerGlobalAnalysis) {
      router.replace(
        buildSmartImportCompletionQuery(searchParams?.toString() || '', true),
        { scroll: false },
      )
      return
    }

    window.location.reload()
  }, [projectId, queryClient, router, searchParams])

  // 如果已进入智能分集模式，显示 SmartImportWizard
  if (smartSplitMode) {
    return (
      <SmartImportWizard
        projectId={projectId}
        onManualCreate={() => setSmartSplitMode(false)}
        onImportComplete={handleSmartSplitComplete}
        initialRawContent={smartSplitText}
      />
    )
  }

  return (
    <NovelInputStage
      novelText={novelText}
      episodeName={episodeName}
      onNovelTextChange={runtime.onNovelTextChange}
      isSubmittingTask={runtime.isSubmittingTTS || runtime.isStartingStoryToScript}
      isSwitchingStage={runtime.isTransitioning}
      videoRatio={runtime.videoRatio ?? undefined}
      artStyle={runtime.artStyle ?? undefined}
      onVideoRatioChange={runtime.onVideoRatioChange}
      onArtStyleChange={runtime.onArtStyleChange}
      onNext={runtime.onRunStoryToScript}
      onSmartSplit={handleSmartSplit}
    />
  )
}
