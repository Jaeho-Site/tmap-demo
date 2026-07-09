import type { Course, Difficulty, LatLng, Waypoint } from '@/types/course'
import type { PurposeId } from '@/data/daejeonData'
import { WALKWAYS } from '@/data/walkways'
import { WALKWAY_ROUTES } from '@/data/walkwayRoutes'
import { STREETS } from '@/data/streets'
import { STREET_ROUTES } from '@/data/streetRoutes'
import { midpoint } from '@/lib/geo'

// 코스 카드 썸네일 — r1~r6 순환(코스별 실사진 확보 전 임시, DESIGN_SYSTEM §7)
const THUMBS = [
  '/images/r1.jpg',
  '/images/r2.webp',
  '/images/r3.jpg',
  '/images/r4.jpg',
  '/images/r5.jpg',
  '/images/r6.jpg',
]
const thumb = (i: number) => THUMBS[i % THUMBS.length]

const MIN_DISTANCE = 400 // m — 너무 짧은 구간은 코스에서 제외
const MAX_COURSES = 120 // 지도 클러터 방지

const toPath = (raw: [number, number][]): LatLng[] => raw.map(([lat, lng]) => ({ lat, lng }))

const diffFromKm = (km: number): Difficulty => (km < 1.2 ? 'easy' : km < 3 ? 'moderate' : 'hard')

// 보행 속도 ≈ 67 m/분. TMAP time(초)이 있으면 그것을 우선.
const estMin = (distance: number, time: number | null): number =>
  Math.max(1, Math.round((time ?? (distance / 67) * 60) / 60))

function waypointsFrom(path: LatLng[]): Waypoint[] {
  return [
    { ...path[0], kind: 'start', label: '출발' },
    { ...midpoint(path), kind: 'via', label: '경유' },
    { ...path[path.length - 1], kind: 'end', label: '도착' },
  ]
}

let cached: Course[] | null = null

/**
 * 실제 대전 데이터에서 코스 카탈로그를 생성한다.
 * · 보행전용도로(WALKWAY_ROUTES) → 🛡️ 안전 (CCTV·보안등 데이터가 두터움)
 * · 가로수길(STREET_ROUTES)       → 🌳 자연 (대전 차별화 요소)
 * 경로/거리/시간은 TMAP 보행자 경로안내로 사전 검증된 값.
 */
export function getCourses(): Course[] {
  if (cached) return cached
  const out: Course[] = []
  let idx = 0

  for (const w of WALKWAYS) {
    if (w.isPoint) continue
    const r = WALKWAY_ROUTES[w.id]
    if (!r || r.distance == null || r.distance < MIN_DISTANCE || r.path.length < 2) continue
    const path = toPath(r.path)
    const km = Math.round(r.distance / 100) / 10
    const purposes: PurposeId[] = ['safety']
    if (w.separated) purposes.push('joint') // 보차분리 = 평탄·저충격 보행에 유리
    out.push({
      id: `wk-${w.id}`,
      name: w.name,
      area: `${w.district} ${w.dong}`.trim(),
      distanceKm: km,
      estMinutes: estMin(r.distance, r.time),
      difficulty: diffFromKm(km),
      purposes,
      path,
      waypoints: waypointsFrom(path),
      thumbnail: thumb(idx++),
      confidence: { safety: 'verified', joint: 'estimated' },
      source: 'walkway',
    })
  }

  for (const s of STREETS) {
    const r = STREET_ROUTES[s.id]
    if (!r || r.distance == null || r.distance < MIN_DISTANCE || r.path.length < 2) continue
    const path = toPath(r.path)
    const km = Math.round(r.distance / 100) / 10
    out.push({
      id: `st-${s.id}`,
      name: s.name,
      area: s.district,
      distanceKm: km,
      estMinutes: estMin(r.distance, r.time),
      difficulty: diffFromKm(km),
      purposes: ['nature'],
      path,
      waypoints: waypointsFrom(path),
      thumbnail: thumb(idx++),
      confidence: { nature: 'verified' },
      source: 'street',
    })
  }

  // 긴 코스 우선으로 상한 적용
  cached = out.sort((a, b) => b.distanceKm - a.distanceKm).slice(0, MAX_COURSES)
  return cached
}

/** id → Course 조회 맵. */
export function getCourseMap(): Map<string, Course> {
  return new Map(getCourses().map((c) => [c.id, c]))
}
