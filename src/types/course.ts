import type { PurposeId } from '@/data/daejeonData'

export type Difficulty = 'easy' | 'moderate' | 'hard'
export type ConfidenceLevel = 'verified' | 'estimated' | 'low'

export interface LatLng {
  lat: number
  lng: number
}

export interface Waypoint extends LatLng {
  kind: 'start' | 'via' | 'turn' | 'end'
  label?: string
}

/** 추천/지도/산책이 공유하는 코스 모델 (DEV_PLAN §3). */
export interface Course {
  id: string
  name: string
  area: string
  distanceKm: number
  estMinutes: number
  difficulty: Difficulty
  purposes: PurposeId[]
  path: LatLng[]
  waypoints: Waypoint[]
  thumbnail?: string
  /** 목적별 정직한 신뢰도 (UX P7). */
  confidence: Partial<Record<PurposeId, ConfidenceLevel>>
  /** 자연어 추천 이유 — Phase 2 추천 엔진에서 채움. */
  reason?: string
  source: 'walkway' | 'street' | 'park'
}
