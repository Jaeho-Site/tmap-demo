import { useEffect, useRef } from 'react'
import { DAEJEON_CENTER, DEFAULT_ZOOM } from '../config'
import { ALL_POINTS, PURPOSES, type MapPoint, type PurposeId } from '../data/daejeonData'
import { PARKS, type Park } from '../data/parks'
import { parkColor } from '../data/parkMeta'
import { STREETS, type Street } from '../data/streets'
import { treeColor } from '../data/streetMeta'
import { STREET_ROUTES } from '../data/streetRoutes'

const PURPOSE_COLOR: Record<PurposeId, string> = Object.fromEntries(
  PURPOSES.map((p) => [p.id, p.color]),
) as Record<PurposeId, string>

// dB 값에 따른 색: 낮으면 조용(파랑)~높으면 시끄러움(빨강)
function noiseColor(db: number): string {
  if (db <= 30) return '#1d4ed8'
  if (db <= 38) return '#0891b2'
  if (db <= 44) return '#f59e0b'
  return '#dc2626'
}

// 컬러 핀 SVG를 data URL로 생성 (보고서 지점용)
function pinDataUrl(color: string, glyph: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
    <path d="M16 0C7.6 0 1 6.6 1 15c0 10 15 27 15 27s15-17 15-27C31 6.6 24.4 0 16 0z" fill="${color}" stroke="#ffffff" stroke-width="2"/>
    <circle cx="16" cy="15" r="9" fill="#ffffff"/>
    <text x="16" y="20" font-size="12" text-anchor="middle" fill="${color}" font-family="Arial">${glyph}</text>
  </svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

// 작은 원형 노드 (공원용)
function dotDataUrl(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
    <circle cx="8" cy="8" r="5.5" fill="${color}" stroke="#ffffff" stroke-width="2"/>
  </svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

// 마름모 노드 (가로수길용) — 공원 원형과 구분
function diamondDataUrl(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
    <rect x="3.5" y="3.5" width="9" height="9" rx="1.5" transform="rotate(45 8 8)" fill="${color}" stroke="#ffffff" stroke-width="2"/>
  </svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

const PURPOSE_GLYPH: Record<PurposeId, string> = {
  safety: '🛡',
  nature: '🌳',
  quiet: '♪',
  joint: '🦵',
}

function iconFor(point: MapPoint): string {
  if (point.purpose === 'quiet') {
    const db = parseFloat(point.metric ?? '99')
    return pinDataUrl(noiseColor(db), '♪')
  }
  return pinDataUrl(PURPOSE_COLOR[point.purpose], PURPOSE_GLYPH[point.purpose])
}

function infoContent(point: MapPoint): string {
  const badge = point.metric
    ? `<span style="background:${PURPOSE_COLOR[point.purpose]};color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">${point.metric}</span>`
    : ''
  const approx = point.approx
    ? '<div style="color:#b45309;font-size:11px;margin-top:6px;">※ 원본에 좌표 없음 — 주소/장소 기반 근사 좌표</div>'
    : ''
  return `<div style="min-width:210px;max-width:260px;padding:12px 14px;font-family:system-ui,sans-serif;line-height:1.45;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
      <strong style="font-size:14px;color:#111;">${point.name}</strong>${badge}
    </div>
    <div style="font-size:12px;color:#374151;">${point.detail}</div>
    ${approx}
  </div>`
}

function tagChips(tags: string[]): string {
  return tags
    .map(
      (t) =>
        `<span style="display:inline-block;background:#eef2ff;color:#3730a3;padding:2px 7px;border-radius:8px;font-size:11px;margin:2px 3px 0 0;">#${t}</span>`,
    )
    .join('')
}

function parkInfoContent(park: Park): string {
  const color = parkColor(park.category)
  const area = park.area ? `${park.area.toLocaleString()} ㎡` : '면적 미상'
  return `<div style="min-width:220px;max-width:280px;padding:12px 14px;font-family:system-ui,sans-serif;line-height:1.45;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
      <strong style="font-size:14px;color:#111;">${park.name}</strong>
      <span style="background:${color};color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">${park.category}</span>
    </div>
    <div style="font-size:12px;color:#374151;">${park.district} · ${area}</div>
    ${park.address ? `<div style="font-size:11px;color:#6b7280;margin-top:2px;">${park.address}</div>` : ''}
    <div style="margin-top:6px;">${tagChips(park.tags)}</div>
  </div>`
}

function streetInfoContent(s: Street, endpoint: '시작' | '종료'): string {
  const color = treeColor(s.treeType)
  const route = STREET_ROUTES[s.id]
  const walk = route?.distance != null
    ? `보행 ${route.distance.toLocaleString()}m${route.time != null ? ` · 약 ${Math.round(route.time / 60)}분` : ''}`
    : '보행경로 없음(직선 표시)'
  const meta = [
    s.length != null ? `${s.length} km` : null,
    s.count != null ? `${s.count.toLocaleString()}그루` : null,
    s.plantYear != null ? `${s.plantYear}년 식재` : null,
  ].filter(Boolean).join(' · ')
  return `<div style="min-width:230px;max-width:290px;padding:12px 14px;font-family:system-ui,sans-serif;line-height:1.45;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
      <strong style="font-size:14px;color:#111;">${s.name}</strong>
      <span style="background:${color};color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">${endpoint}</span>
    </div>
    <div style="font-size:12px;color:#374151;">${s.district} · ${s.treeType}</div>
    <div style="font-size:11px;color:#2563eb;margin-top:3px;">🚶 ${walk}${meta ? ` · ${meta}` : ''}</div>
    ${s.section ? `<div style="font-size:11px;color:#6b7280;margin-top:2px;">구간: ${s.section}</div>` : ''}
    ${s.intro ? `<div style="font-size:11px;color:#4b5563;margin-top:4px;">${s.intro}</div>` : ''}
    <div style="margin-top:6px;">${tagChips(s.tags)}</div>
  </div>`
}

interface MapViewProps {
  activeLayers: Record<PurposeId, boolean>
  showParks: boolean
  activeCategories: Record<string, boolean>
  showStreets: boolean
  focus?: { lat: number; lng: number } | null
}

interface MarkerEntry {
  marker: Tmapv2.Marker
  point: MapPoint
}
interface ParkEntry {
  marker: Tmapv2.Marker
  park: Park
}
interface StreetEntry {
  startMarker: Tmapv2.Marker
  endMarker: Tmapv2.Marker
  line: Tmapv2.Polyline
}

export function MapView({
  activeLayers,
  showParks,
  activeCategories,
  showStreets,
  focus,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Tmapv2.Map | null>(null)
  const markersRef = useRef<MarkerEntry[]>([])
  const parksRef = useRef<ParkEntry[]>([])
  const streetsRef = useRef<StreetEntry[]>([])
  const infoRef = useRef<Tmapv2.InfoWindow | null>(null)

  // 지도 1회 생성 + 마커 생성 (보고서 지점 + 465개 공원 노드)
  useEffect(() => {
    if (!containerRef.current || !window.Tmapv2 || mapRef.current) return
    const T = window.Tmapv2

    const map = new T.Map(containerRef.current, {
      center: new T.LatLng(DAEJEON_CENTER.lat, DAEJEON_CENTER.lng),
      zoom: DEFAULT_ZOOM,
      width: '100%',
      height: '100%',
      zoomControl: true,
      scrollwheel: true,
    })
    mapRef.current = map

    const openInfo = (content: string, lat: number, lng: number) => {
      infoRef.current?.setMap(null)
      infoRef.current = new T.InfoWindow({
        position: new T.LatLng(lat, lng),
        content,
        type: 2,
        map,
      })
    }

    // 보고서 지점 (핀)
    markersRef.current = ALL_POINTS.map((point) => {
      const marker = new T.Marker({
        position: new T.LatLng(point.lat, point.lng),
        icon: iconFor(point),
        iconSize: new T.Size(32, 42),
        map,
        title: point.name,
      })
      marker.addListener('click', () => openInfo(infoContent(point), point.lat, point.lng))
      return { marker, point }
    })

    // 공원 노드 (작은 원) — 처음엔 map에 붙이지 않고 토글로 제어
    parksRef.current = PARKS.map((park) => {
      const marker = new T.Marker({
        position: new T.LatLng(park.lat, park.lng),
        icon: dotDataUrl(parkColor(park.category)),
        iconSize: new T.Size(16, 16),
        title: park.name,
      })
      marker.addListener('click', () => openInfo(parkInfoContent(park), park.lat, park.lng))
      return { marker, park }
    })

    // 가로수길: 시작·종료를 각각 노드로. 둘 사이는 TMAP 보행 경로(있으면)로 연결, 없으면 직선 폴백.
    streetsRef.current = STREETS.map((s) => {
      const color = treeColor(s.treeType)
      const route = STREET_ROUTES[s.id]
      const hasRoute = !!route && route.path.length >= 2

      const path = hasRoute
        ? route.path.map(([lat, lng]) => new T.LatLng(lat, lng))
        : [new T.LatLng(s.startLat, s.startLng), new T.LatLng(s.endLat, s.endLng)]
      const line = new T.Polyline({
        path,
        strokeColor: color,
        strokeWeight: hasRoute ? 5 : 3,
        strokeOpacity: hasRoute ? 0.9 : 0.45,
        strokeStyle: hasRoute ? 'solid' : 'dash',
      })

      // 시작 노드(◆) / 종료 노드(●)
      const startMarker = new T.Marker({
        position: new T.LatLng(s.startLat, s.startLng),
        icon: diamondDataUrl(color),
        iconSize: new T.Size(16, 16),
        title: `${s.name} (시작)`,
      })
      startMarker.addListener('click', () =>
        openInfo(streetInfoContent(s, '시작'), s.startLat, s.startLng),
      )
      const endMarker = new T.Marker({
        position: new T.LatLng(s.endLat, s.endLng),
        icon: dotDataUrl(color),
        iconSize: new T.Size(16, 16),
        title: `${s.name} (종료)`,
      })
      endMarker.addListener('click', () =>
        openInfo(streetInfoContent(s, '종료'), s.endLat, s.endLng),
      )
      return { startMarker, endMarker, line }
    })

    return () => {
      infoRef.current?.setMap(null)
      markersRef.current.forEach((m) => m.marker.setMap(null))
      parksRef.current.forEach((p) => p.marker.setMap(null))
      streetsRef.current.forEach((s) => {
        s.startMarker.setMap(null)
        s.endMarker.setMap(null)
        s.line.setMap(null)
      })
      markersRef.current = []
      parksRef.current = []
      streetsRef.current = []
      map.destroy?.()
      mapRef.current = null
    }
  }, [])

  // 보고서 레이어 토글
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markersRef.current.forEach(({ marker, point }) => {
      marker.setMap(activeLayers[point.purpose] ? map : null)
    })
  }, [activeLayers])

  // 공원 노드 토글 (전체 on/off + 구분별 필터)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    parksRef.current.forEach(({ marker, park }) => {
      const visible = showParks && activeCategories[park.category] !== false
      marker.setMap(visible ? map : null)
    })
  }, [showParks, activeCategories])

  // 가로수길 토글 (연결선 + 노드 함께)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    streetsRef.current.forEach(({ startMarker, endMarker, line }) => {
      const m = showStreets ? map : null
      startMarker.setMap(m)
      endMarker.setMap(m)
      line.setMap(m)
    })
  }, [showStreets])

  // 특정 좌표로 이동
  useEffect(() => {
    const map = mapRef.current
    if (!map || !focus || !window.Tmapv2) return
    map.setCenter(new window.Tmapv2.LatLng(focus.lat, focus.lng))
    map.setZoom(16)
  }, [focus])

  return <div ref={containerRef} className="map-canvas" />
}
