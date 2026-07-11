import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import type { Course, LatLng } from '@/types/course'
import { PURPOSES, type PurposeId } from '@/data/daejeonData'
import { DAEJEON_CENTER } from '@/config'
import { midpoint } from '@/lib/geo'

const PURPOSE_COLOR = Object.fromEntries(PURPOSES.map((p) => [p.id, p.color])) as Record<
  PurposeId,
  string
>

// 네이버식 현위치 마커 — 파란 코어 + 흰 링
const USER_DOT =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">
      <circle cx="13" cy="13" r="11" fill="#3b82f6" fill-opacity="0.18"/>
      <circle cx="13" cy="13" r="6" fill="#2b6bff" stroke="#ffffff" stroke-width="3"/>
    </svg>`,
  )

export interface TmapMapHandle {
  zoomIn(): void
  zoomOut(): void
  panTo(p: LatLng, zoom?: number): void
}

interface TmapMapProps {
  /** 전체 카탈로그(안정 참조). */
  courses: Course[]
  /** 선택된 목적 필터(null=전체). */
  filterPurpose?: PurposeId | null
  selectedId?: string | null
  userLocation?: LatLng | null
  /** AI 추천 경로(모험) — 안내선으로 표시. */
  guidePath?: LatLng[] | null
  /** 실시간 이동 경로(모험) — 걸을수록 그려짐. */
  livePath?: LatLng[] | null
  onSelectCourse?: (id: string) => void
  className?: string
}

export const TmapMap = forwardRef<TmapMapHandle, TmapMapProps>(function TmapMap(
  { courses, filterPurpose, selectedId, userLocation, guidePath, livePath, onSelectCourse, className },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Tmapv2.Map | null>(null)
  const linesRef = useRef<Map<string, Tmapv2.Polyline>>(new Map())
  const highlightRef = useRef<Tmapv2.Polyline | null>(null)
  const guideRef = useRef<Tmapv2.Polyline | null>(null)
  const liveRef = useRef<Tmapv2.Polyline | null>(null)
  const userRef = useRef<Tmapv2.Marker | null>(null)
  const onSelectRef = useRef(onSelectCourse)
  onSelectRef.current = onSelectCourse

  const courseMap = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses])

  useImperativeHandle(ref, () => ({
    zoomIn() {
      const m = mapRef.current
      if (m) m.setZoom(Math.min(19, m.getZoom() + 1))
    },
    zoomOut() {
      const m = mapRef.current
      if (m) m.setZoom(Math.max(7, m.getZoom() - 1))
    },
    panTo(p, zoom) {
      const m = mapRef.current
      const T = window.Tmapv2
      if (!m || !T) return
      m.setCenter(new T.LatLng(p.lat, p.lng))
      if (zoom) m.setZoom(zoom)
    },
  }))

  // 지도 + 코스 폴리라인 1회 생성
  useEffect(() => {
    if (!containerRef.current || !window.Tmapv2 || mapRef.current) return
    const T = window.Tmapv2
    // StrictMode 재마운트 시 컨테이너에 이전 지도 DOM이 남지 않도록 정리
    if (containerRef.current.firstChild) containerRef.current.innerHTML = ''
    const map = new T.Map(containerRef.current, {
      center: new T.LatLng(DAEJEON_CENTER.lat, DAEJEON_CENTER.lng),
      zoom: 13,
      width: '100%',
      height: '100%',
      zoomControl: false, // 네이버 스타일 커스텀 컨트롤 사용
      scrollwheel: true,
    })
    mapRef.current = map

    for (const c of courses) {
      const color = PURPOSE_COLOR[c.purposes[0]] ?? '#2563eb'
      const line = new T.Polyline({
        path: c.path.map((p) => new T.LatLng(p.lat, p.lng)),
        strokeColor: color,
        strokeWeight: 5,
        strokeOpacity: 0.85,
        map,
      })
      try {
        line.addListener?.('click', () => onSelectRef.current?.(c.id))
      } catch {
        /* 폴리라인 클릭 미지원 시 무시 — 시트에서 선택 */
      }
      linesRef.current.set(c.id, line)
    }

    const lines = linesRef.current
    return () => {
      // TMAP 내부 teardown이 간헐적으로 throw → 각 단계 방어적으로 감쌈
      const safe = (fn: () => void) => {
        try {
          fn()
        } catch {
          /* noop */
        }
      }
      lines.forEach((l) => safe(() => l.setMap(null)))
      lines.clear()
      safe(() => highlightRef.current?.setMap(null))
      safe(() => guideRef.current?.setMap(null))
      safe(() => liveRef.current?.setMap(null))
      safe(() => userRef.current?.setMap(null))
      safe(() => map.destroy?.())
      highlightRef.current = null
      guideRef.current = null
      liveRef.current = null
      userRef.current = null
      mapRef.current = null
    }
  }, [courses])

  // 베이스 폴리라인 가시성 — 선택 > 필터 단일 계산(두 이펙트가 서로 덮어쓰지 않도록 통합)
  // 선택된 경로가 있으면 나머지 초록선은 전부 숨기고 라임 하이라이트만 노출,
  // 선택 해제 시 목적 필터 규칙대로 전체/필터 폴리라인 복원.
  // NOTE: TMAP은 폴리라인을 캔버스에 그려 setMap(null)로는 화면에서 지워지지 않는다.
  //       반드시 setVisible(false)를 써야 실제로 숨겨진다.
  useEffect(() => {
    if (!mapRef.current) return
    linesRef.current.forEach((line, id) => {
      let show: boolean
      if (selectedId) {
        show = false
      } else {
        const c = courseMap.get(id)
        show = !filterPurpose || (c ? c.purposes.includes(filterPurpose) : false)
      }
      line.setVisible(show)
    })
  }, [filterPurpose, selectedId, courseMap])

  // 선택 하이라이트(라임) — 위에 덧그림
  useEffect(() => {
    const map = mapRef.current
    const T = window.Tmapv2
    if (!map || !T) return
    highlightRef.current?.setVisible(false) // 캔버스 잔상 제거(setMap(null)만으론 안 지워짐)
    highlightRef.current?.setMap(null)
    highlightRef.current = null
    if (!selectedId) return
    const c = courseMap.get(selectedId)
    if (!c) return
    highlightRef.current = new T.Polyline({
      path: c.path.map((p) => new T.LatLng(p.lat, p.lng)),
      strokeColor: '#b6f35e',
      strokeWeight: 8,
      strokeOpacity: 1,
      map,
    })
    const mid = midpoint(c.path)
    map.setCenter(new T.LatLng(mid.lat, mid.lng))
    map.setZoom(15)
  }, [selectedId, courseMap])

  // 현위치 마커
  useEffect(() => {
    const map = mapRef.current
    const T = window.Tmapv2
    if (!map || !T || !userLocation) return
    userRef.current?.setMap(null)
    userRef.current = new T.Marker({
      position: new T.LatLng(userLocation.lat, userLocation.lng),
      icon: USER_DOT,
      iconSize: new T.Size(26, 26),
      map,
    })
  }, [userLocation])

  // AI 추천 경로(모험) — 보라색 안내선
  useEffect(() => {
    const map = mapRef.current
    const T = window.Tmapv2
    if (!map || !T) return
    guideRef.current?.setVisible(false)
    guideRef.current?.setMap(null)
    guideRef.current = null
    if (!guidePath || guidePath.length < 2) return
    guideRef.current = new T.Polyline({
      path: guidePath.map((p) => new T.LatLng(p.lat, p.lng)),
      strokeColor: '#8b5cf6',
      strokeWeight: 6,
      strokeOpacity: 0.9,
      map,
    })
  }, [guidePath])

  // 실시간 이동 경로(모험) — 라임, 걸을수록 위에 덧그림
  useEffect(() => {
    const map = mapRef.current
    const T = window.Tmapv2
    if (!map || !T) return
    liveRef.current?.setVisible(false)
    liveRef.current?.setMap(null)
    liveRef.current = null
    if (!livePath || livePath.length < 2) return
    liveRef.current = new T.Polyline({
      path: livePath.map((p) => new T.LatLng(p.lat, p.lng)),
      strokeColor: '#b6f35e',
      strokeWeight: 6,
      strokeOpacity: 1,
      map,
    })
  }, [livePath])

  return <div ref={containerRef} className={className} />
})
