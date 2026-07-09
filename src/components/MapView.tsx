import { useEffect, useRef, useState } from 'react'
import { DAEJEON_CENTER, DEFAULT_ZOOM } from '../config'
import { ALL_POINTS, PURPOSES, type MapPoint, type PurposeId } from '../data/daejeonData'
import { PARKS, type Park } from '../data/parks'
import { parkColor } from '../data/parkMeta'
import { STREETS, type Street } from '../data/streets'
import { treeColor } from '../data/streetMeta'
import { STREET_ROUTES } from '../data/streetRoutes'
import { WALKWAYS, type Walkway } from '../data/walkways'
import { WALKWAY_ROUTES } from '../data/walkwayRoutes'
import { OSM_PATHS, type OsmPath, type OsmPathCategory } from '../data/osmPaths'
import { OSM_PATH_COLORS, OSM_PATH_LABELS } from '../data/osmPathMeta'
import { TMAP_RIVER_WALKS, type TmapRiverWalk } from '../data/tmapRiverWalks'
import { TMAP_ARBORETUM_WALKS, type TmapArboretumWalk } from '../data/tmapArboretumWalks'
import { OSM_GAPCHEON_WALKS, type OsmGapcheonWalk } from '../data/osmGapcheonWalks'
import { OSM_GAPCHEON_COLOR } from '../data/osmGapcheonMeta'
import { OSM_WALK_EDGES, type OsmWalkEdge } from '../data/osmWalkEdges'
import { OSM_WALK_EDGE_COLOR } from '../data/osmWalkEdgeMeta'

// 보행자전용도로: 보차분리 여부로 색 구분
const WALKWAY_SEP = '#2563eb' // 보차분리 O
const WALKWAY_MIX = '#64748b' // 보차분리 X/미상
const walkwayColor = (w: Walkway) => (w.separated ? WALKWAY_SEP : WALKWAY_MIX)

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

// 사각 노드 (보행자전용도로용) — 원/마름모와 구분
function squareDataUrl(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 15 15">
    <rect x="2.5" y="2.5" width="10" height="10" rx="2" fill="${color}" stroke="#ffffff" stroke-width="2"/>
  </svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function smallNodeDataUrl(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 11 11">
    <circle cx="5.5" cy="5.5" r="3.5" fill="${color}" stroke="#ffffff" stroke-width="1.4"/>
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

function uniqueTags(tags: string[]) {
  return [...new Set(tags)]
}

function inferOsmGapcheonTags(walk: OsmGapcheonWalk) {
  const tags = ['river', 'gapcheon', 'open-view']
  if (walk.surface === 'paved' || walk.surface === 'asphalt' || walk.surface === 'concrete') tags.push('flat', 'paved')
  if (walk.highway === 'footway' || walk.highway === 'path' || walk.highway === 'pedestrian') tags.push('pedestrian')
  if (walk.highway === 'cycleway' || walk.bicycle === 'designated') tags.push('shared-bike')
  if (walk.foot === 'designated' || walk.foot === 'yes') tags.push('walkable')
  if (walk.length >= 1000) tags.push('long')
  if (walk.length <= 300) tags.push('short', 'connector')
  if (walk.length > 300 && walk.length < 1000) tags.push('medium')
  return uniqueTags(tags)
}

function inferTmapRiverTags(walk: TmapRiverWalk) {
  const distance = walk.distance ?? 0
  const tags = ['river', 'gapcheon', 'open-view', 'pedestrian', 'walkable', 'tmap-route']
  if (distance >= 1000) tags.push('long')
  if (distance > 300 && distance < 1000) tags.push('medium')
  if (distance <= 300) tags.push('short')
  return uniqueTags(tags)
}

function inferTmapArboretumTags(walk: TmapArboretumWalk) {
  const distance = walk.distance ?? walk.osmLength
  const tags = ['park', 'arboretum', 'quiet', 'loop', 'pedestrian', 'walkable', 'tmap-route']
  if (distance <= 250) tags.push('short', 'connector')
  if (distance > 250) tags.push('medium')
  if (distance >= 500) tags.push('long')
  return uniqueTags(tags)
}

function inferOsmPathTags(path: OsmPath) {
  const tags: string[] = [path.category]
  if (path.category === 'park_walk') tags.push('park', 'quiet', 'pedestrian')
  if (path.category === 'river_walk') tags.push('river', 'open-view')
  if (path.surface) tags.push('paved')
  if (path.length >= 1000) tags.push('long')
  if (path.length <= 300) tags.push('short', 'connector')
  if (path.length > 300 && path.length < 1000) tags.push('medium')
  return uniqueTags(tags)
}

function tagDescription(tags: string[]) {
  const phrases = []
  if (tags.includes('river')) phrases.push('하천변')
  if (tags.includes('park')) phrases.push('공원 내부')
  if (tags.includes('quiet')) phrases.push('조용한 산책')
  if (tags.includes('open-view')) phrases.push('개방감')
  if (tags.includes('loop')) phrases.push('순환 산책')
  if (tags.includes('flat')) phrases.push('평탄한 포장로')
  if (tags.includes('shared-bike')) phrases.push('자전거 겸용')
  return phrases.join(' · ') || '산책 후보 구간'
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

function walkwayInfoContent(w: Walkway, endpoint: '시작' | '종료' | '지점'): string {
  const color = walkwayColor(w)
  const route = WALKWAY_ROUTES[w.id]
  const walk = w.isPoint
    ? '점형 지점(시작=종료)'
    : route?.distance != null
      ? `보행 ${route.distance.toLocaleString()}m${route.time != null ? ` · 약 ${Math.round(route.time / 60)}분` : ''}`
      : '보행경로 없음(직선 표시)'
  const facil = [
    w.cctv > 0 ? `CCTV ${w.cctv}` : null,
    w.lamp > 0 ? `보안등 ${w.lamp}` : null,
    w.crosswalk > 0 ? `횡단보도 ${w.crosswalk}` : null,
    w.braille > 0 ? `점자블록 ${w.braille}` : null,
  ].filter(Boolean).join(' · ')
  const meta = [
    w.width != null ? `보도폭 ${w.width}m` : null,
    `보차분리 ${w.separated ? 'O' : 'X'}`,
  ].filter(Boolean).join(' · ')
  return `<div style="min-width:230px;max-width:290px;padding:12px 14px;font-family:system-ui,sans-serif;line-height:1.45;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
      <strong style="font-size:14px;color:#111;">${w.name}</strong>
      <span style="background:${color};color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">${endpoint}</span>
    </div>
    <div style="font-size:12px;color:#374151;">${w.district} ${w.dong} · ${meta}</div>
    <div style="font-size:11px;color:#2563eb;margin-top:3px;">🚶 ${walk}</div>
    ${facil ? `<div style="font-size:11px;color:#4b5563;margin-top:2px;">시설: ${facil}</div>` : ''}
    <div style="margin-top:6px;">${tagChips(w.tags)}</div>
  </div>`
}

function osmPathInfoContent(path: OsmPath, nodeLabel: string): string {
  const color = OSM_PATH_COLORS[path.category]
  const surface = path.surface ? ` · 포장 ${path.surface}` : ''
  const tags = inferOsmPathTags(path)
  return `<div style="min-width:230px;max-width:300px;padding:12px 14px;font-family:system-ui,sans-serif;line-height:1.45;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
      <strong style="font-size:14px;color:#111;">${path.name}</strong>
      <span style="background:${color};color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">${nodeLabel}</span>
    </div>
    <div style="font-size:12px;color:#374151;">${OSM_PATH_LABELS[path.category]} · ${path.length.toLocaleString()}m</div>
    <div style="font-size:11px;color:#2563eb;margin-top:3px;">OSM way ${path.osmId} · ${path.highway || 'waterway'}${surface}</div>
    <div style="font-size:11px;color:#4b5563;margin-top:4px;">${tagDescription(tags)}</div>
    <div style="margin-top:6px;">${tagChips(tags)}</div>
    <div style="font-size:11px;color:#4b5563;margin-top:4px;">경로 노드 ${path.nodes.length.toLocaleString()}개 중 지도 성능을 위해 일부 노드를 샘플 표시합니다.</div>
  </div>`
}

function tmapRiverWalkInfoContent(walk: TmapRiverWalk, nodeLabel: string): string {
  const distance = walk.distance != null ? `${walk.distance.toLocaleString()}m` : '거리 미상'
  const time = walk.time != null ? ` · 약 ${Math.round(walk.time / 60)}분` : ''
  const tags = inferTmapRiverTags(walk)
  return `<div style="min-width:230px;max-width:300px;padding:12px 14px;font-family:system-ui,sans-serif;line-height:1.45;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
      <strong style="font-size:14px;color:#111;">${walk.name}</strong>
      <span style="background:#f97316;color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">${nodeLabel}</span>
    </div>
    <div style="font-size:12px;color:#374151;">${walk.river} · TMAP 보행자 길찾기</div>
    <div style="font-size:11px;color:#ea580c;margin-top:3px;">🚶 ${distance}${time} · 경로 노드 ${walk.path.length}개</div>
    <div style="font-size:11px;color:#4b5563;margin-top:4px;">${tagDescription(tags)}</div>
    <div style="margin-top:6px;">${tagChips(tags)}</div>
    <div style="font-size:11px;color:#4b5563;margin-top:4px;">${walk.startName} → ${walk.endName}</div>
  </div>`
}

function tmapArboretumWalkInfoContent(walk: TmapArboretumWalk, nodeLabel: string): string {
  const distance = walk.distance != null ? `${walk.distance.toLocaleString()}m` : '거리 미상'
  const time = walk.time != null ? ` · 약 ${Math.round(walk.time / 60)}분` : ''
  const tags = inferTmapArboretumTags(walk)
  return `<div style="min-width:230px;max-width:300px;padding:12px 14px;font-family:system-ui,sans-serif;line-height:1.45;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
      <strong style="font-size:14px;color:#111;">${walk.name}</strong>
      <span style="background:#14b8a6;color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">${nodeLabel}</span>
    </div>
    <div style="font-size:12px;color:#374151;">한밭수목원 · TMAP 보행자 길찾기</div>
    <div style="font-size:11px;color:#0f766e;margin-top:3px;">🚶 ${distance}${time} · 경로 노드 ${walk.path.length}개</div>
    <div style="font-size:11px;color:#4b5563;margin-top:4px;">${tagDescription(tags)}</div>
    <div style="margin-top:6px;">${tagChips(tags)}</div>
    <div style="font-size:11px;color:#4b5563;margin-top:4px;">${walk.startName} → ${walk.endName}</div>
  </div>`
}

function osmGapcheonWalkInfoContent(walk: OsmGapcheonWalk, nodeLabel: string): string {
  const surface = walk.surface ? ` · 포장 ${walk.surface}` : ''
  const access = [walk.highway, walk.foot ? `foot=${walk.foot}` : null, walk.bicycle ? `bicycle=${walk.bicycle}` : null]
    .filter(Boolean)
    .join(' · ')
  const tags = inferOsmGapcheonTags(walk)
  return `<div style="min-width:230px;max-width:310px;padding:12px 14px;font-family:system-ui,sans-serif;line-height:1.45;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
      <strong style="font-size:14px;color:#111;">${walk.name}</strong>
      <span style="background:${OSM_GAPCHEON_COLOR};color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">${nodeLabel}</span>
    </div>
    <div style="font-size:12px;color:#374151;">충남대~엑스포공원 갑천 주변 OSM 산책로 · ${walk.length.toLocaleString()}m</div>
    <div style="font-size:11px;color:#7e22ce;margin-top:3px;">OSM way ${walk.osmId} · ${access}${surface}</div>
    <div style="font-size:11px;color:#4b5563;margin-top:4px;">${tagDescription(tags)}</div>
    <div style="margin-top:6px;">${tagChips(tags)}</div>
    <div style="font-size:11px;color:#4b5563;margin-top:4px;">경로 노드 ${walk.nodes.length.toLocaleString()}개</div>
  </div>`
}

function osmWalkEdgeInfoContent(edge: OsmWalkEdge, nodeLabel: string): string {
  const tags = [
    ...edge.routeTypeHints,
    edge.tags.highway,
    edge.tags.surface,
    edge.tags.foot ? `foot=${edge.tags.foot}` : null,
    edge.tags.bicycle ? `bicycle=${edge.tags.bicycle}` : null,
  ].filter(Boolean) as string[]
  return `<div style="min-width:230px;max-width:320px;padding:12px 14px;font-family:system-ui,sans-serif;line-height:1.45;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
      <strong style="font-size:14px;color:#111;">${edge.tags.name || edge.id}</strong>
      <span style="background:${OSM_WALK_EDGE_COLOR};color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">${nodeLabel}</span>
    </div>
    <div style="font-size:12px;color:#374151;">OSM walk edge · ${edge.length.toLocaleString()}m</div>
    <div style="font-size:11px;color:#6d28d9;margin-top:3px;">way ${edge.osmWayId} · walkable ${Math.round(edge.costHints.walkableScore * 100)} · comfort ${Math.round(edge.costHints.comfortScore * 100)}</div>
    <div style="margin-top:6px;">${tagChips(tags)}</div>
  </div>`
}

function sampledOsmNodes(path: OsmPath, budget: number) {
  if (budget <= 0 || path.nodes.length === 0) return []
  const desired = path.length >= 800 ? 5 : path.length >= 250 ? 3 : 1
  const count = Math.min(desired, budget, path.nodes.length)
  if (count === 1) {
    const index = Math.floor(path.nodes.length / 2)
    return [{ node: path.nodes[index], label: '노드' }]
  }

  const used = new Set<number>()
  return Array.from({ length: count }, (_, i) => {
    const index = Math.round((i * (path.nodes.length - 1)) / (count - 1))
    const safeIndex = used.has(index) ? Math.min(path.nodes.length - 1, index + 1) : index
    used.add(safeIndex)
    const label = safeIndex === 0 ? '시작 노드' : safeIndex === path.nodes.length - 1 ? '종료 노드' : '중간 노드'
    return { node: path.nodes[safeIndex], label }
  })
}

interface MapViewProps {
  activeLayers: Record<PurposeId, boolean>
  showParks: boolean
  activeCategories: Record<string, boolean>
  showStreets: boolean
  showWalkways: boolean
  showTmapRiverWalks: boolean
  showTmapArboretumWalks: boolean
  showOsmGapcheonWalks: boolean
  showOsmWalkEdges: boolean
  activeOsmPaths: Record<OsmPathCategory, boolean>
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
interface WalkwayEntry {
  startMarker: Tmapv2.Marker
  endMarker: Tmapv2.Marker | null
  line: Tmapv2.Polyline | null
}
interface OsmPathEntry {
  line: Tmapv2.Polyline
  nodeMarkers: Tmapv2.Marker[]
  path: OsmPath
}
interface TmapRiverWalkEntry {
  line: Tmapv2.Polyline
  nodeMarkers: Tmapv2.Marker[]
  walk: TmapRiverWalk
}
interface TmapArboretumWalkEntry {
  line: Tmapv2.Polyline
  nodeMarkers: Tmapv2.Marker[]
  walk: TmapArboretumWalk
}
interface OsmGapcheonWalkEntry {
  line: Tmapv2.Polyline
  nodeMarkers: Tmapv2.Marker[]
  walk: OsmGapcheonWalk
}
interface OsmWalkEdgeEntry {
  line: Tmapv2.Polyline
  nodeMarkers: Tmapv2.Marker[]
  edge: OsmWalkEdge
}

export function MapView({
  activeLayers,
  showParks,
  activeCategories,
  showStreets,
  showWalkways,
  showTmapRiverWalks,
  showTmapArboretumWalks,
  showOsmGapcheonWalks,
  showOsmWalkEdges,
  activeOsmPaths,
  focus,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Tmapv2.Map | null>(null)
  const markersRef = useRef<MarkerEntry[]>([])
  const parksRef = useRef<ParkEntry[]>([])
  const streetsRef = useRef<StreetEntry[]>([])
  const walkwaysRef = useRef<WalkwayEntry[]>([])
  const osmPathsRef = useRef<OsmPathEntry[]>([])
  const tmapRiverWalksRef = useRef<TmapRiverWalkEntry[]>([])
  const tmapArboretumWalksRef = useRef<TmapArboretumWalkEntry[]>([])
  const osmGapcheonWalksRef = useRef<OsmGapcheonWalkEntry[]>([])
  const osmWalkEdgesRef = useRef<OsmWalkEdgeEntry[]>([])
  const infoRef = useRef<Tmapv2.InfoWindow | null>(null)
  const [infoPanel, setInfoPanel] = useState<string | null>(null)

  const openInfo = (content: string, lat: number, lng: number) => {
    const map = mapRef.current
    const T = window.Tmapv2
    if (!map || !T) return
    infoRef.current?.setMap(null)
    infoRef.current = null
    setInfoPanel(content)
    map.setCenter(new T.LatLng(lat, lng))
  }

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

    // 보행자전용도로: 시작·종료 노드(사각) + TMAP 보행경로. 점형(isPoint)은 노드 1개만.
    walkwaysRef.current = WALKWAYS.map((w) => {
      const color = walkwayColor(w)
      const startMarker = new T.Marker({
        position: new T.LatLng(w.startLat, w.startLng),
        icon: squareDataUrl(color),
        iconSize: new T.Size(15, 15),
        title: w.isPoint ? w.name : `${w.name} (시작)`,
      })
      startMarker.addListener('click', () =>
        openInfo(walkwayInfoContent(w, w.isPoint ? '지점' : '시작'), w.startLat, w.startLng),
      )

      if (w.isPoint) return { startMarker, endMarker: null, line: null }

      const route = WALKWAY_ROUTES[w.id]
      const hasRoute = !!route && route.path.length >= 2
      const path = hasRoute
        ? route.path.map(([lat, lng]) => new T.LatLng(lat, lng))
        : [new T.LatLng(w.startLat, w.startLng), new T.LatLng(w.endLat, w.endLng)]
      const line = new T.Polyline({
        path,
        strokeColor: color,
        strokeWeight: hasRoute ? 5 : 3,
        strokeOpacity: hasRoute ? 0.9 : 0.45,
        strokeStyle: hasRoute ? 'solid' : 'dash',
      })
      const endMarker = new T.Marker({
        position: new T.LatLng(w.endLat, w.endLng),
        icon: squareDataUrl(color),
        iconSize: new T.Size(15, 15),
        title: `${w.name} (종료)`,
      })
      endMarker.addListener('click', () =>
        openInfo(walkwayInfoContent(w, '종료'), w.endLat, w.endLng),
      )
      return { startMarker, endMarker, line }
    })

    let osmNodeBudget = 1800
    osmPathsRef.current = OSM_PATHS.filter((path) => path.category === 'park_walk').map((path) => {
      const color = OSM_PATH_COLORS[path.category]
      const line = new T.Polyline({
        path: path.nodes.map((node) => new T.LatLng(node.lat, node.lng)),
        strokeColor: color,
        strokeWeight: path.category === 'park_walk' ? 3 : 4,
        strokeOpacity: path.category === 'park_walk' ? 0.42 : 0.5,
        strokeStyle: path.category === 'park_walk' ? 'solid' : 'dash',
      })

      const samples = sampledOsmNodes(path, osmNodeBudget)
      osmNodeBudget -= samples.length
      const icon = smallNodeDataUrl(color)
      const nodeMarkers = samples.map(({ node, label }) => {
        const marker = new T.Marker({
          position: new T.LatLng(node.lat, node.lng),
          icon,
          iconSize: new T.Size(11, 11),
          title: `${path.name} (${label})`,
        })
        marker.addListener('click', () =>
          openInfo(osmPathInfoContent(path, label), node.lat, node.lng),
        )
        return marker
      })

      return { line, nodeMarkers, path }
    })

    const tmapRiverNodeIcon = smallNodeDataUrl('#f97316')
    tmapRiverWalksRef.current = TMAP_RIVER_WALKS.map((walk) => {
      const line = new T.Polyline({
        path: walk.path.map(([lat, lng]) => new T.LatLng(lat, lng)),
        strokeColor: '#f97316',
        strokeWeight: 6,
        strokeOpacity: 0.92,
        strokeStyle: 'solid',
      })

      const nodeMarkers = walk.path.map(([lat, lng], index) => {
        const label =
          index === 0 ? '시작 노드' : index === walk.path.length - 1 ? '종료 노드' : `노드 ${index + 1}`
        const marker = new T.Marker({
          position: new T.LatLng(lat, lng),
          icon: tmapRiverNodeIcon,
          iconSize: new T.Size(11, 11),
          title: `${walk.name} (${label})`,
        })
        marker.addListener('click', () => openInfo(tmapRiverWalkInfoContent(walk, label), lat, lng))
        return marker
      })

      return { line, nodeMarkers, walk }
    })

    const tmapArboretumNodeIcon = smallNodeDataUrl('#14b8a6')
    tmapArboretumWalksRef.current = TMAP_ARBORETUM_WALKS.map((walk) => {
      const line = new T.Polyline({
        path: walk.path.map(([lat, lng]) => new T.LatLng(lat, lng)),
        strokeColor: '#14b8a6',
        strokeWeight: 5,
        strokeOpacity: 0.9,
        strokeStyle: 'solid',
      })

      const nodeMarkers = walk.path.map(([lat, lng], index) => {
        const label =
          index === 0 ? '시작 노드' : index === walk.path.length - 1 ? '종료 노드' : `노드 ${index + 1}`
        const marker = new T.Marker({
          position: new T.LatLng(lat, lng),
          icon: tmapArboretumNodeIcon,
          iconSize: new T.Size(11, 11),
          title: `${walk.name} (${label})`,
        })
        marker.addListener('click', () =>
          openInfo(tmapArboretumWalkInfoContent(walk, label), lat, lng),
        )
        return marker
      })

      return { line, nodeMarkers, walk }
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
      walkwaysRef.current.forEach((w) => {
        w.startMarker.setMap(null)
        w.endMarker?.setMap(null)
        w.line?.setMap(null)
      })
      osmPathsRef.current.forEach((path) => {
        path.line.setMap(null)
        path.nodeMarkers.forEach((marker) => marker.setMap(null))
      })
      tmapRiverWalksRef.current.forEach((walk) => {
        walk.line.setMap(null)
        walk.nodeMarkers.forEach((marker) => marker.setMap(null))
      })
      tmapArboretumWalksRef.current.forEach((walk) => {
        walk.line.setMap(null)
        walk.nodeMarkers.forEach((marker) => marker.setMap(null))
      })
      osmGapcheonWalksRef.current.forEach((walk) => {
        walk.line.setMap(null)
        walk.nodeMarkers.forEach((marker) => marker.setMap(null))
      })
      osmWalkEdgesRef.current.forEach((edge) => {
        edge.line.setMap(null)
        edge.nodeMarkers.forEach((marker) => marker.setMap(null))
      })
      markersRef.current = []
      parksRef.current = []
      streetsRef.current = []
      walkwaysRef.current = []
      osmPathsRef.current = []
      tmapRiverWalksRef.current = []
      tmapArboretumWalksRef.current = []
      osmGapcheonWalksRef.current = []
      osmWalkEdgesRef.current = []
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

  // 보행자전용도로 토글
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    walkwaysRef.current.forEach(({ startMarker, endMarker, line }) => {
      const m = showWalkways ? map : null
      startMarker.setMap(m)
      endMarker?.setMap(m)
      line?.setMap(m)
    })
  }, [showWalkways])

  // OSM 공원 내부 산책로/하천로 토글
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    osmPathsRef.current.forEach(({ line, nodeMarkers, path }) => {
      const m = activeOsmPaths[path.category] ? map : null
      line.setMap(m)
      nodeMarkers.forEach((marker) => marker.setMap(m))
    })
  }, [activeOsmPaths])

  // TMAP 보행자 길찾기로 구운 갑천 보행로 토글
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    tmapRiverWalksRef.current.forEach(({ line, nodeMarkers }) => {
      const m = showTmapRiverWalks ? map : null
      line.setMap(m)
      nodeMarkers.forEach((marker) => marker.setMap(m))
    })
  }, [showTmapRiverWalks])

  // TMAP 보행자 길찾기로 구운 한밭수목원 내부 산책로 토글
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    tmapArboretumWalksRef.current.forEach(({ line, nodeMarkers }) => {
      const m = showTmapArboretumWalks ? map : null
      line.setMap(m)
      nodeMarkers.forEach((marker) => marker.setMap(m))
    })
  }, [showTmapArboretumWalks])

  // 충남대~엑스포공원 사이 갑천 주변 OSM 산책로 토글
  useEffect(() => {
    const map = mapRef.current
    const T = window.Tmapv2
    if (!map || !T) return

    if (showOsmGapcheonWalks && osmGapcheonWalksRef.current.length === 0) {
      const osmGapcheonNodeIcon = smallNodeDataUrl(OSM_GAPCHEON_COLOR)
      let osmGapcheonNodeBudget = 1200
      osmGapcheonWalksRef.current = OSM_GAPCHEON_WALKS.map((walk) => {
        const line = new T.Polyline({
          path: walk.nodes.map((node) => new T.LatLng(node.lat, node.lng)),
          strokeColor: OSM_GAPCHEON_COLOR,
          strokeWeight: 4,
          strokeOpacity: 0.72,
          strokeStyle: 'solid',
        })

        const desiredNodeCount = walk.length >= 800 ? 5 : walk.length >= 250 ? 3 : 1
        const sampleCount = Math.min(desiredNodeCount, osmGapcheonNodeBudget, walk.nodes.length)
        osmGapcheonNodeBudget -= sampleCount
        const samples = sampleCount <= 1
          ? [{ node: walk.nodes[Math.floor(walk.nodes.length / 2)], index: Math.floor(walk.nodes.length / 2) }]
          : Array.from({ length: sampleCount }, (_, sampleIndex) => {
              const index = Math.round((sampleIndex * (walk.nodes.length - 1)) / (sampleCount - 1))
              return { node: walk.nodes[index], index }
            })

        const nodeMarkers = samples.map(({ node, index }) => {
          const label =
            index === 0 ? '시작 노드' : index === walk.nodes.length - 1 ? '종료 노드' : `노드 ${index + 1}`
          const marker = new T.Marker({
            position: new T.LatLng(node.lat, node.lng),
            icon: osmGapcheonNodeIcon,
            iconSize: new T.Size(11, 11),
            title: `${walk.name} (${label})`,
          })
          marker.addListener('click', () =>
            openInfo(osmGapcheonWalkInfoContent(walk, label), node.lat, node.lng),
          )
          return marker
        })

        return { line, nodeMarkers, walk }
      })
    }

    osmGapcheonWalksRef.current.forEach(({ line, nodeMarkers }) => {
      const m = showOsmGapcheonWalks ? map : null
      line.setMap(m)
      nodeMarkers.forEach((marker) => marker.setMap(m))
    })
  }, [showOsmGapcheonWalks])

  useEffect(() => {
    const map = mapRef.current
    const T = window.Tmapv2
    if (!map || !T) return

    if (showOsmWalkEdges && osmWalkEdgesRef.current.length === 0) {
      const edgeNodeIcon = smallNodeDataUrl(OSM_WALK_EDGE_COLOR)
      let nodeBudget = 1000
      osmWalkEdgesRef.current = OSM_WALK_EDGES.map((edge) => {
        const line = new T.Polyline({
          path: edge.nodes.map((node) => new T.LatLng(node.lat, node.lng)),
          strokeColor: OSM_WALK_EDGE_COLOR,
          strokeWeight: edge.routeTypeHints.includes('connector') ? 3 : 4,
          strokeOpacity: edge.routeTypeHints.includes('connector') ? 0.45 : 0.68,
          strokeStyle: edge.routeTypeHints.includes('connector') ? 'dash' : 'solid',
        })

        const sampleIndexes = nodeBudget <= 0
          ? []
          : edge.nodes.length <= 2
          ? [0, edge.nodes.length - 1]
          : [0, Math.floor(edge.nodes.length / 2), edge.nodes.length - 1]
        const uniqueIndexes = [...new Set(sampleIndexes)].slice(0, Math.max(0, nodeBudget))
        nodeBudget -= uniqueIndexes.length

        const nodeMarkers = uniqueIndexes.map((index) => {
          const node = edge.nodes[index]
          const label = index === 0 ? 'edge start' : index === edge.nodes.length - 1 ? 'edge end' : 'edge mid'
          const marker = new T.Marker({
            position: new T.LatLng(node.lat, node.lng),
            icon: edgeNodeIcon,
            iconSize: new T.Size(11, 11),
            title: `${edge.tags.name || edge.id} (${label})`,
          })
          marker.addListener('click', () => openInfo(osmWalkEdgeInfoContent(edge, label), node.lat, node.lng))
          return marker
        })

        return { line, nodeMarkers, edge }
      })
    }

    osmWalkEdgesRef.current.forEach(({ line, nodeMarkers }) => {
      const m = showOsmWalkEdges ? map : null
      line.setMap(m)
      nodeMarkers.forEach((marker) => marker.setMap(m))
    })
  }, [showOsmWalkEdges])

  // 특정 좌표로 이동
  useEffect(() => {
    const map = mapRef.current
    if (!map || !focus || !window.Tmapv2) return
    map.setCenter(new window.Tmapv2.LatLng(focus.lat, focus.lng))
    map.setZoom(16)
  }, [focus])

  return (
    <>
      <div ref={containerRef} className="map-canvas" />
      {infoPanel && (
        <div className="map-info-panel">
          <button type="button" aria-label="정보 닫기" onClick={() => setInfoPanel(null)}>
            ×
          </button>
          <div dangerouslySetInnerHTML={{ __html: infoPanel }} />
        </div>
      )}
    </>
  )
}
