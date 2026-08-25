export function buildSmartImportCompletionQuery(
  currentQuery: string,
  triggerGlobalAnalysis: boolean,
) {
  const params = new URLSearchParams(currentQuery)
  params.delete('assetLibrary')

  if (triggerGlobalAnalysis) {
    params.set('stage', 'assets')
    params.set('globalAnalyze', '1')
  } else {
    params.delete('globalAnalyze')
  }

  const query = params.toString()
  return query ? `?${query}` : '?'
}
