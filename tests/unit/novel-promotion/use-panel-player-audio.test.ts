import { describe, expect, it } from 'vitest'
import { prepareVideoForAudiblePlayback } from '@/app/[locale]/workspace/[projectId]/modes/novel-promotion/components/video/panel-card/runtime/hooks/usePanelPlayer'

describe('panel video audio initialization', () => {
  it('restores audible playback defaults for generated videos', () => {
    const video = {
      defaultMuted: true,
      muted: true,
      volume: 0,
    } as HTMLVideoElement

    prepareVideoForAudiblePlayback(video)

    expect(video.defaultMuted).toBe(false)
    expect(video.muted).toBe(false)
    expect(video.volume).toBe(1)
  })
})
