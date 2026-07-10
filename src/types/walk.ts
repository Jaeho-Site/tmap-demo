import type { LatLng } from './course'

/** 완주/중단된 산책 1건의 기록 (US-6.1). */
export interface WalkRecord {
  id: string
  courseId: string
  courseName: string
  area: string
  startedAt: number
  endedAt: number
  durationSec: number
  distanceM: number
  completed: boolean
  notes: string[]
  /** 다운샘플된 이동 경로(요약/지도 재현용). */
  track: LatLng[]
  /** 완주 후 피드백(Phase 4에서 채움). */
  rating?: 'up' | 'down'
  tags?: string[]
  retrospective?: string
}
