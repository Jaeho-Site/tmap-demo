import { useCallback, useEffect, useRef, useState } from 'react'
import type { LatLng } from '@/types/course'
import { haversine } from '@/lib/geo'

const JITTER_MIN = 2 // m — GPS 흔들림 필터

export type FreeWalkStatus = 'idle' | 'recording' | 'paused' | 'done'

/**
 * 자유 산책(모험) 세션. 정해진 코스 없이 실제 이동을 그대로 기록한다.
 * AI 추천 경로가 있으면 시뮬레이터가 그 경로를 따라가고, 없으면 현위치에서 자연스럽게 배회한다.
 * 코스 기반 진행과 분리해 완주/이탈 판정 없이 "걸은 만큼 기록"에만 집중한다.
 */
export function useFreeWalk() {
  const [status, setStatus] = useState<FreeWalkStatus>('idle')
  const [elapsedSec, setElapsedSec] = useState(0)
  const [distanceM, setDistanceM] = useState(0)
  const [userPos, setUserPos] = useState<LatLng | null>(null)
  const [track, setTrack] = useState<LatLng[]>([])
  const [simulating, setSimulating] = useState(false)

  const distRef = useRef(0)
  const lastRef = useRef<LatLng | null>(null)
  const trackRef = useRef<LatLng[]>([])
  const startedAtRef = useRef(0)
  const guideRef = useRef<LatLng[] | null>(null)
  const simIdxRef = useRef(0)
  const headingRef = useRef(0)

  // 새 위치 반영(watch/시뮬 공통). React 업데이터가 아닌 순수 콜백 → 중복 집계 없음.
  const onPos = useCallback((p: LatLng) => {
    const last = lastRef.current
    if (last) {
      const d = haversine(last, p)
      if (d < JITTER_MIN) return
      distRef.current += d
      setDistanceM(distRef.current)
    }
    lastRef.current = p
    trackRef.current = [...trackRef.current, p]
    setTrack(trackRef.current)
    setUserPos(p)
  }, [])

  const start = useCallback((opts?: { guide?: LatLng[] | null; origin?: LatLng | null }) => {
    distRef.current = 0
    simIdxRef.current = 0
    headingRef.current = Math.random() * Math.PI * 2
    guideRef.current = opts?.guide ?? null
    startedAtRef.current = Date.now()
    const origin = opts?.origin ?? null
    lastRef.current = origin
    trackRef.current = origin ? [origin] : []
    setDistanceM(0)
    setElapsedSec(0)
    setTrack(trackRef.current)
    setUserPos(origin)
    setStatus('recording')
  }, [])

  const pause = useCallback(() => setStatus((s) => (s === 'recording' ? 'paused' : s)), [])
  const resume = useCallback(() => setStatus((s) => (s === 'paused' ? 'recording' : s)), [])
  const end = useCallback(() => setStatus((s) => (s === 'idle' ? s : 'done')), [])
  const cancel = useCallback(() => {
    lastRef.current = null
    trackRef.current = []
    distRef.current = 0
    setSimulating(false)
    setStatus('idle')
  }, [])
  const toggleSim = useCallback(() => setSimulating((v) => !v), [])

  // 경과 타이머(기록 중에만)
  useEffect(() => {
    if (status !== 'recording') return
    const t = setInterval(() => setElapsedSec((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [status])

  // 실제 GPS watch (시뮬 중엔 비활성)
  useEffect(() => {
    if (status !== 'recording' || simulating || !('geolocation' in navigator)) return
    const id = navigator.geolocation.watchPosition(
      (p) => onPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [status, simulating, onPos])

  // 시뮬레이터 — 추천 경로가 있으면 따라가고, 없으면 현위치에서 배회
  useEffect(() => {
    if (status !== 'recording' || !simulating) return
    const timer = window.setInterval(() => {
      const guide = guideRef.current
      if (guide && guide.length > 1) {
        const step = Math.max(1, Math.floor(guide.length / 80))
        const idx = Math.min(simIdxRef.current, guide.length - 1)
        onPos(guide[idx])
        if (idx >= guide.length - 1) {
          setStatus('done')
          return
        }
        simIdxRef.current += step
      } else {
        const base = lastRef.current
        if (!base) return
        headingRef.current += (Math.random() - 0.5) * 0.8 // 완만히 방향 변화
        const stepM = 10 + Math.random() * 6
        const dLat = (stepM * Math.cos(headingRef.current)) / 111320
        const dLng =
          (stepM * Math.sin(headingRef.current)) / (111320 * Math.cos((base.lat * Math.PI) / 180))
        onPos({ lat: base.lat + dLat, lng: base.lng + dLng })
      }
    }, 500)
    return () => clearInterval(timer)
  }, [status, simulating, onPos])

  return {
    status,
    elapsedSec,
    distanceM,
    userPos,
    track,
    simulating,
    startedAt: startedAtRef.current,
    start,
    pause,
    resume,
    end,
    cancel,
    toggleSim,
  }
}
