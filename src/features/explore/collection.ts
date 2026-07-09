import type { Course } from '@/types/course'
import { getCourses, getCourseMap } from '@/features/recommend/courses'
import { listWalks } from '@/features/history/records'

// 대전 탐험 도감 (US-6.3). 산책 기록에서 정복도·배지·희귀도를 계산.
// 미검증(안 걸은) 경로를 드러내 자연스럽게 피드백을 유도(E4 연결).

const DISTRICTS = ['유성구', '서구', '중구', '동구', '대덕구']

const districtOf = (area: string) => area.split(' ')[0]

/** 완주한 코스 id 집합 = 수집 완료. */
export function getExploredIds(): Set<string> {
  return new Set(listWalks().filter((w) => w.completed).map((w) => w.courseId))
}

export interface DistrictProgress {
  district: string
  total: number
  walked: number
  pct: number
}

export function getDistrictProgress(): DistrictProgress[] {
  const courses = getCourses()
  const explored = getExploredIds()
  return DISTRICTS.map((district) => {
    const inDist = courses.filter((c) => districtOf(c.area) === district)
    const walked = inDist.filter((c) => explored.has(c.id)).length
    const total = inDist.length
    return { district, total, walked, pct: total ? Math.round((walked / total) * 100) : 0 }
  }).filter((d) => d.total > 0)
}

export function getOverallPct(): number {
  const courses = getCourses()
  const explored = getExploredIds()
  const walked = courses.filter((c) => explored.has(c.id)).length
  return courses.length ? Math.round((walked / courses.length) * 100) : 0
}

export interface Rarity {
  tier: string
  cls: string
}

/** 거리 기반 희귀도 등급(수집 재미). */
export function rarityOf(c: Course): Rarity {
  const k = c.distanceKm
  if (k >= 5) return { tier: '전설', cls: 'text-amber-400' }
  if (k >= 2.5) return { tier: '영웅', cls: 'text-purple-400' }
  if (k >= 1.2) return { tier: '희귀', cls: 'text-sky-400' }
  return { tier: '일반', cls: 'text-fg-muted' }
}

export interface Badge {
  id: string
  emoji: string
  label: string
  desc: string
  earned: boolean
}

/** 배지 언락 — 실제 기록 조건에서 계산. */
export function getBadges(): Badge[] {
  const walks = listWalks()
  const courseMap = getCourseMap()
  const completed = walks.filter((w) => w.completed)
  const districts = new Set(
    completed.map((w) => districtOf(courseMap.get(w.courseId)?.area ?? '')).filter(Boolean),
  )
  const hasDawn = walks.some((w) => new Date(w.endedAt).getHours() < 7)
  const hasNote = walks.some((w) => w.notes.length > 0)
  const gaveFeedback = walks.some((w) => w.rating === 'down' && (w.tags?.length ?? 0) > 0)

  return [
    { id: 'first', emoji: '🥾', label: '첫 걸음', desc: '첫 산책 완료', earned: walks.length >= 1 },
    { id: 'finisher', emoji: '🏅', label: '완주왕', desc: '3회 이상 완주', earned: completed.length >= 3 },
    { id: 'dawn', emoji: '🌅', label: '새벽 산책러', desc: '오전 7시 이전 산책', earned: hasDawn },
    { id: 'writer', emoji: '✍️', label: '기록가', desc: '산책 중 메모 남기기', earned: hasNote },
    { id: 'partner', emoji: '🤝', label: '피드백 파트너', desc: '문제 태그로 길 개선', earned: gaveFeedback },
    { id: 'explorer', emoji: '🗺️', label: '대전 탐험가', desc: '2개 구 이상 탐험', earned: districts.size >= 2 },
  ]
}
