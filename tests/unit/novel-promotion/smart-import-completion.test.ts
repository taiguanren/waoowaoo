import { describe, expect, it } from 'vitest'
import { buildSmartImportCompletionQuery } from '@/lib/novel-promotion/smart-import-completion'

describe('smart import completion navigation', () => {
  it('routes confirm-and-analyze to assets and preserves unrelated query state', () => {
    const query = buildSmartImportCompletionQuery('episode=old-episode&foo=bar&assetLibrary=1', true)
    const params = new URLSearchParams(query)

    expect(params.get('stage')).toBe('assets')
    expect(params.get('globalAnalyze')).toBe('1')
    expect(params.get('episode')).toBe('old-episode')
    expect(params.get('foo')).toBe('bar')
    expect(params.has('assetLibrary')).toBe(false)
  })

  it('does not leave a stale global-analysis trigger after a normal confirm', () => {
    const query = buildSmartImportCompletionQuery('stage=config&globalAnalyze=1', false)
    const params = new URLSearchParams(query)

    expect(params.get('stage')).toBe('config')
    expect(params.has('globalAnalyze')).toBe(false)
  })
})
