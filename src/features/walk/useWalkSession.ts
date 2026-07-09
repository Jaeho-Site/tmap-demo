import { useCallback, useEffect, useRef, useState } from 'react'
import type { Course, LatLng } from '@/types/course'
import { haversine } from '@/lib/geo'

const WAYPOINT_TOLERANCE = 35 // m — 핵심 지점 도달 허용 반경(US-3.2)
const OFFROUTE_THRESHOLD = 45 // m — 경로 이탈 판정
const JITTER_MIN = 2 // m — GPS 흔들림 필터

interface SessionState {
  status: 'walking' | 'done'
  elapsedSec: number
  distanceM: number
  userPos: LatLng | null
  accuracy: number | null
  nextIdx: number
  offRoute: boolean
  simulating: boolean
}

/**
 * 산책 진행 세션 (US-3.1~3.2). 실제 GPS watch 또는 시뮬레이터로 진행하며
 * 허용 반경 기반 완주/이탈을 감지한다. 수동 종료는 항상 가능(UX 가드레일 6).
 */
export function useWalkSession(course: Course) {
  const [state, setState] = useState<SessionState>({
    status: 'walking',
    elapsedSec: 0,
    distanceM: 0,
    userPos: null,
    accuracy: null,
    nextIdx: 0,
    offRoute: false,
    simulating: false,
  })
  const lastPosRef = useRef<LatLng | null>(null)
  const trackRef = useRef<LatLng[]>([])
  const startedAtRef = useRef<number>(Date.now())

  const onPosition = useCallback(
    (pos: LatLng, accuracy: number | null) => {
      setState((s) => {
        if (s.status === 'done') return s
        let distanceM = s.distanceM
        const last = lastPosRef.current
        if (last) {
          const d = haversine(last, pos)
          if (d >= JITTER_MIN) distanceM += d
        }
        lastPosRef.current = pos
        trackRef.current.push(pos)

        // 순차 핵심 지점 도달
        let nextIdx = s.nextIdx
        let status: SessionState['status'] = s.status
        const wp = course.waypoints[nextIdx]
        if (wp && haversine(pos, wp) <= WAYPOINT_TOLERANCE) {
          nextIdx = Math.min(course.waypoints.length, nextIdx + 1)
        }
        // 도착 지점 도달 = 완주(순서 어긋나도 보정)
        const end = course.waypoints[course.waypoints.length - 1]
        if (end && haversine(pos, end) <= WAYPOINT_TOLERANCE) {
          status = 'done'
          nextIdx = course.waypoints.length
        }

        const minToPath = course.path.reduce((m, p) => Math.min(m, haversine(pos, p)), Infinity)
        const offRoute = minToPath > OFFROUTE_THRESHOLD

        return { ...s, distanceM, userPos: pos, accuracy, nextIdx, status, offRoute }
      })
    },
    [course],
  )

  // 타이머
  useEffect(() => {
    const t = setInterval(
      () => setState((s) => (s.status === 'walking' ? { ...s, elapsedSec: s.elapsedSec + 1 } : s)),
      1000,
    )
    return () => clearInterval(t)
  }, [])

  // 실제 GPS watch (시뮬레이션 중엔 비활성)
  useEffect(() => {
    if (state.simulating || !('geolocation' in navigator)) return
    const id = navigator.geolocation.watchPosition(
      (p) => onPosition({ lat: p.coords.latitude, lng: p.coords.longitude }, p.coords.accuracy),
      () => {},
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [state.simulating, onPosition])

  // 시뮬레이터 — 경로를 따라 이동(실기기 없이 데모/개발)
  useEffect(() => {
    if (!state.simulating) return
    const path = course.path
    const stepSize = Math.max(1, Math.floor(path.length / 60))
    let i = 0
    const timer = window.setInterval(() => {
      const idx = Math.min(i, path.length - 1)
      onPosition(path[idx], 5)
      if (idx >= path.length - 1) {
        clearInterval(timer)
        return
      }
      i += stepSize
    }, 450)
    return () => clearInterval(timer)
  }, [state.simulating, onPosition, course])

  const toggleSim = useCallback(() => setState((s) => ({ ...s, simulating: !s.simulating })), [])
  const dismissOffRoute = useCallback(() => setState((s) => ({ ...s, offRoute: false })), [])
  const endWalk = useCallback(() => setState((s) => ({ ...s, status: 'done' })), [])

  return {
    ...state,
    track: trackRef.current,
    startedAt: startedAtRef.current,
    toggleSim,
    dismissOffRoute,
    endWalk,
  }
}
