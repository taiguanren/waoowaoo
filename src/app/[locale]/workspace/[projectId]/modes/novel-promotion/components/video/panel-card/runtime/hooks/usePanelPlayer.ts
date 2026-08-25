import { logError as _ulogError } from '@/lib/logging/core'
import { useCallback, useRef, useState, type MouseEvent, type SyntheticEvent } from 'react'

interface UsePanelPlayerParams {
  videoRatio: string
  imageUrl?: string
  videoUrl?: string
  lipSyncVideoUrl?: string
  showLipSyncVideo: boolean
  onPreviewImage?: (imageUrl: string) => void
}

export function prepareVideoForAudiblePlayback(video: HTMLVideoElement) {
  video.defaultMuted = false
  video.muted = false
  video.volume = 1
}

export function usePanelPlayer({
  videoRatio,
  imageUrl,
  videoUrl,
  lipSyncVideoUrl,
  showLipSyncVideo,
  onPreviewImage,
}: UsePanelPlayerParams) {
  const [isPlaying, setIsPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const cssAspectRatio = videoRatio.replace(':', '/')
  const currentVideoUrl = videoUrl
    ? (showLipSyncVideo && lipSyncVideoUrl ? lipSyncVideoUrl : videoUrl)
    : undefined

  const handlePreviewImage = useCallback((event?: MouseEvent) => {
    if (event) event.stopPropagation()
    if (!imageUrl || !onPreviewImage) return
    onPreviewImage(imageUrl)
  }, [imageUrl, onPreviewImage])

  const handlePlayClick = useCallback(async () => {
    setIsPlaying(true)
    const video = videoRef.current
    if (!video) return

    prepareVideoForAudiblePlayback(video)
    try {
      await video.play()
    } catch (error: unknown) {
      if ((error as { name?: string }).name !== 'AbortError') {
        _ulogError('Video play error:', error)
      }
    }
  }, [])

  const handleVideoLoadedMetadata = useCallback((event: SyntheticEvent<HTMLVideoElement>) => {
    prepareVideoForAudiblePlayback(event.currentTarget)
  }, [])

  return {
    cssAspectRatio,
    currentVideoUrl,
    isPlaying,
    setIsPlaying,
    videoRef,
    handlePreviewImage,
    handlePlayClick,
    handleVideoLoadedMetadata,
  }
}
