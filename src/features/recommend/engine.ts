import type { Course, LatLng } from '@/types/course'
import type { Conditions } from '@/store/conditions'
import { haversine } from '@/lib/geo'

/**
 * 룰 기반 추천 스코어링 (LLM 아님 — 환각 방지, PRD §6.2).
 * 지도 API가 이미 계산한 실제 코스 속성만으로 후보를 정렬한다.
 */
function score(course: Course, origin: LatLng, cond: Conditions): number {
  let s = 0

  // 근접성 — 5km 이내에서 가까울수록 (가중치 2)
  const d = haversine(origin, course.path[0])
  s += Math.max(0, 1 - d / 5000) * 2

  // 목적 일치 — 선택된 목적을 포함하면 강하게 가산 (가중치 3/개)
  if (cond.purposes.length) {
    const matches = course.purposes.filter((p) => cond.purposes.includes(p)).length
    s += matches * 3
    if (matches === 0) s -= 1.5
  }

  // 시간 적합 — 요청 분과 가까울수록 (가중치 3)
  if (cond.minutes) {
    const diff = Math.abs(course.estMinutes - cond.minutes)
    s += Math.max(0, 1 - diff / cond.minutes) * 3
  }

  // 난이도 일치
  if (cond.difficulty) {
    s += course.difficulty === cond.difficulty ? 2 : -0.5
  }

  // 검증된 신뢰도 보너스
  const verified = Object.values(course.confidence).filter((v) => v === 'verified').length
  s += verified * 0.5

  return s
}

/** 조건/위치 기준으로 코스를 내림차순 정렬해 반환. */
export function rankCourses(courses: Course[], origin: LatLng, cond: Conditions): Course[] {
  return [...courses]
    .map((c) => ({ c, s: score(c, origin, cond) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.c)
}
