import type { LatLng } from '@/types/course'
import { haversine } from '@/lib/geo'

/** AI가 제안한 산책 경로(모험 탭). Course와 달리 카탈로그에 없는 즉석 경로. */
export interface SuggestedRoute {
  id: string
  name: string
  distanceKm: number
  estMinutes: number
  trip: TripType
  path: LatLng[]
  waypoints: LatLng[]
  /** 정직한 안내문(예시 경로임을 명시). */
  summary: string
}

export type TripType = 'round' | 'oneway'

export interface RouteMood {
  id: string
  label: string
  emoji: string
  /** 요약문에 쓰이는 분위기 한 마디. */
  vibe: string
}

/** 산책 테마(분위기) — 이름·요약 톤을 결정. */
export const MOODS: RouteMood[] = [
  { id: 'chill', label: '멍때리기', emoji: '🌊', vibe: '생각을 비우고 느긋하게 걷기 좋은' },
  { id: 'nature', label: '자연', emoji: '🌳', vibe: '초록과 물길을 곁에 두고 걷는' },
  { id: 'city', label: '도심', emoji: '🏙️', vibe: '거리와 상점을 지나며 활기를 느끼는' },
  { id: 'exercise', label: '운동', emoji: '🏃', vibe: '심박을 올려 제대로 걷는' },
  { id: 'quiet', label: '조용한 길', emoji: '🤫', vibe: '사람이 적고 차분한' },
]

/** 선택 가능한 산책 거리(km). */
export const DISTANCES = [1, 2, 3, 5]

export interface RouteRequest {
  distanceKm: number
  trip: TripType
  moodId: string
  /** 추가 자연어 요청(선택). */
  note: string
}

const WALK_SPEED_MPM = 67 // m/분 (≈ 4km/h 보행)

/**
 * 현위치와 조건(거리·왕복여부·테마·메모)으로 산책 경로를 제안한다.
 *
 * NOTE (C3, 정직성): 프로토타입에서는 위치·거리 기반의 기하학적 생성기다.
 * 테마·메모는 이름/요약 톤에만 반영되며 실제 지형 매칭은 아직 없다.
 * 실제 LLM 경로추천/보행자 라우팅(TMAP 보행자 경로안내 등)을 붙일 때
 * 이 함수 본문만 원격 호출로 교체하면 UI는 그대로 동작한다.
 */
export async function suggestRoute(origin: LatLng, req: RouteRequest): Promise<SuggestedRoute> {
  await new Promise((r) => setTimeout(r, 700)) // 생성되는 느낌의 지연

  const targetM = req.distanceKm * 1000
  const path = req.trip === 'round' ? generateLoop(origin, targetM) : generateOneWay(origin, targetM)
  const distanceKm = Math.round((perimeter(path) / 1000) * 10) / 10
  const mood = MOODS.find((m) => m.id === req.moodId) ?? MOODS[0]
  const tripLabel = req.trip === 'round' ? '왕복' : '편도'

  return {
    id: `ai-${Date.now()}`,
    name: `${mood.emoji} ${mood.label} · ${distanceKm}km ${tripLabel}`,
    distanceKm,
    estMinutes: Math.round(targetM / WALK_SPEED_MPM),
    trip: req.trip,
    path,
    waypoints: [path[0], path[Math.floor(path.length / 2)], path[path.length - 1]],
    summary: buildSummary(mood, req, distanceKm),
  }
}

function buildSummary(mood: RouteMood, req: RouteRequest, distanceKm: number): string {
  const shape =
    req.trip === 'round'
      ? '현위치에서 시작해 다시 제자리로 돌아와요.'
      : '현위치에서 출발해 한 방향으로 쭉 뻗어 나가요.'
  let s = `${mood.vibe} 약 ${distanceKm}km ${req.trip === 'round' ? '순환' : '편도'} 코스예요. ${shape} 실제 도로·신호·지형은 아직 반영되지 않은 예시 경로이니 걸으며 자유롭게 조정하세요.`
  const note = req.note.trim()
  if (note) s += ` (남겨주신 메모 "${note}"는 프로토타입에선 경로에 직접 반영되진 않지만 기록해 둘게요.)`
  return s
}

/** origin을 시작·도착점으로 하는 유기적인 순환 폴리라인 생성. */
function generateLoop(origin: LatLng, targetM: number): LatLng[] {
  const R = targetM / (2 * Math.PI) // 목표 둘레 → 반지름(m)
  const latM = 111320
  const lngM = 111320 * Math.cos((origin.lat * Math.PI) / 180)
  // origin이 원의 최하단에 오도록 중심을 북쪽으로 R만큼 이동
  const centerLat = origin.lat + R / latM
  const centerLng = origin.lng

  const segs = 48
  const path: LatLng[] = []
  for (let i = 0; i <= segs; i++) {
    const t = i / segs
    const ang = -Math.PI / 2 + t * 2 * Math.PI // 최하단에서 시작해 한 바퀴
    const wobble = 1 + Math.sin(t * Math.PI * 6) * 0.06 // 완만한 굴곡(자연스러움)
    const rr = R * wobble
    path.push({
      lat: centerLat + (rr * Math.sin(ang)) / latM,
      lng: centerLng + (rr * Math.cos(ang)) / lngM,
    })
  }
  // 시작·도착을 정확히 현위치로 고정
  path[0] = { ...origin }
  path[path.length - 1] = { ...origin }
  return path
}

/** origin에서 한 방향으로 완만히 뻗어 나가는 편도 폴리라인 생성. */
function generateOneWay(origin: LatLng, targetM: number): LatLng[] {
  const latM = 111320
  const lngM = 111320 * Math.cos((origin.lat * Math.PI) / 180)
  const segs = 40
  const stepM = targetM / segs
  let heading = Math.random() * Math.PI * 2
  let cur = { ...origin }
  const path: LatLng[] = [cur]
  for (let i = 0; i < segs; i++) {
    heading += (Math.random() - 0.5) * 0.5 // 완만한 곡선
    const dLat = (stepM * Math.cos(heading)) / latM
    const dLng = (stepM * Math.sin(heading)) / lngM
    cur = { lat: cur.lat + dLat, lng: cur.lng + dLng }
    path.push(cur)
  }
  return path
}

function perimeter(path: LatLng[]): number {
  let sum = 0
  for (let i = 1; i < path.length; i++) sum += haversine(path[i - 1], path[i])
  return sum
}
