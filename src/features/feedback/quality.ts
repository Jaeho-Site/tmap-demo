import { isProblemLabel } from './tags'

// 코스 품질/신뢰도 누적 (E4/E7). 1건=의심, 3건+=확정.
// 프로토타입: localStorage. 실서비스는 구간 단위 + GPS 가중 + 시간 감쇠로 확장.
const KEY = 'sanchaek.coursequality'

type QualityMap = Record<string, Record<string, number>> // courseId → tagLabel → count

function readAll(): QualityMap {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as QualityMap
  } catch {
    return {}
  }
}

/** 문제 태그를 코스 품질에 반영(문제 태그만 카운트). */
export function recordProblemTags(courseId: string, tags: string[]): void {
  const problems = tags.filter(isProblemLabel)
  if (!problems.length) return
  try {
    const all = readAll()
    const c = all[courseId] ?? {}
    for (const t of problems) c[t] = (c[t] ?? 0) + 1
    all[courseId] = c
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* 무시 */
  }
}

export interface Caution {
  label: string
  count: number
  level: '의심' | '확정'
}

/** 코스의 주의 사항(신뢰도 등급 포함). */
export function getCourseCautions(courseId: string): Caution[] {
  const c = readAll()[courseId]
  if (!c) return []
  return Object.entries(c)
    .map(([label, count]) => ({ label, count, level: count >= 3 ? '확정' : '의심' }) as Caution)
    .sort((a, b) => b.count - a.count)
}
