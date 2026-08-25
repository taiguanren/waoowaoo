export const MODEL_DEFAULT_FIELDS = [
  'analysisModel',
  'characterModel',
  'locationModel',
  'storyboardModel',
  'editModel',
  'videoModel',
  'audioModel',
  'lipSyncModel',
  'voiceDesignModel',
] as const

export type ModelDefaultField = (typeof MODEL_DEFAULT_FIELDS)[number]
export type ModelDefaultValues = Partial<Record<ModelDefaultField, string>>

export interface ModelKeyRename {
  from: string
  to: string
}

/** Keep explicit model selections pointed at a model whose key was renamed. */
export function replaceModelKeyInDefaults<T extends ModelDefaultValues>(
  defaults: T,
  previousModelKey: string,
  nextModelKey: string,
): T {
  if (!previousModelKey || !nextModelKey || previousModelKey === nextModelKey) return defaults

  let changed = false
  const next = { ...defaults }
  for (const field of MODEL_DEFAULT_FIELDS) {
    if (next[field] === previousModelKey) {
      next[field] = nextModelKey
      changed = true
    }
  }

  return changed ? next : defaults
}
