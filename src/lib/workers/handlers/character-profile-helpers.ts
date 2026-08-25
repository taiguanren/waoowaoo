import { prisma } from '@/lib/prisma'
import { safeParseJsonObject } from '@/lib/json-repair'

export type AnyObj = Record<string, unknown>

export function readText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function readRequiredString(value: unknown, field: string): string {
  const text = readText(value).trim()
  if (!text) {
    throw new Error(`${field} is required`)
  }
  return text
}

export function parseVisualResponse(responseText: string): AnyObj {
  return safeParseJsonObject(responseText) as AnyObj
}

export function collectCharacterSourceEvidence(
  characterName: string,
  episodes: Array<{ novelText?: string | null }> = [],
): string {
  const name = characterName.trim()
  if (!name) return ''

  const evidence: string[] = []
  const seen = new Set<string>()
  for (const episode of episodes) {
    const lines = (episode.novelText || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    for (let index = 0; index < lines.length; index += 1) {
      if (!lines[index].includes(name)) continue
      const start = Math.max(0, index - 1)
      const end = Math.min(lines.length, index + 2)
      const excerpt = lines.slice(start, end).join('\n')
      if (seen.has(excerpt)) continue
      seen.add(excerpt)
      evidence.push(excerpt)
      if (evidence.join('\n---\n').length >= 6000) {
        return evidence.join('\n---\n').slice(0, 6000)
      }
    }
  }
  return evidence.join('\n---\n')
}

export async function resolveProjectModel(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      novelPromotionData: {
        select: {
          id: true,
          analysisModel: true,
          episodes: {
            orderBy: { episodeNumber: 'asc' },
            select: { novelText: true },
          },
        },
      },
    },
  })
  if (!project) throw new Error('Project not found')
  if (!project.novelPromotionData) throw new Error('Novel promotion data not found')
  if (!project.novelPromotionData.analysisModel) throw new Error('请先在项目设置中配置分析模型')
  return project
}
