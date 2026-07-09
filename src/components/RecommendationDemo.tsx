import { useEffect, useMemo, useRef, useState } from 'react'
import { OSM_GAPCHEON_WALKS } from '../data/osmGapcheonWalks'
import { OSM_WALK_EDGES } from '../data/osmWalkEdges'
import { TMAP_ARBORETUM_WALKS } from '../data/tmapArboretumWalks'

type LatLngTuple = [number, number]
type RoutePreference = 'round_trip' | 'one_way'

interface WalkNode {
  id: string
  lat: number
  lng: number
  source: 'OSM' | 'TMAP'
  label: string
  routeName: string
  tags: string[]
  description: string
}

interface WalkEdgeCandidate {
  edgeId: string
  source: 'OSM'
  routeName: string
  fromNodeId: string
  toNodeId: string
  from: { lat: number; lng: number }
  to: { lat: number; lng: number }
  nodes: LatLngTuple[]
  distanceM: number
  tags: string[]
  description: string
  distanceFromStart: number
  entryDistance: number
  exitDistance: number
}

interface WalkTheme {
  id: string
  label: string
  keywords: string[]
  preferredTags: string[]
  prompt: string
}

interface LlmRouteResult {
  nodeIds: string[]
  edgeIds?: string[]
  routeType?: 'one_way' | 'simple_round_trip' | 'loop' | 'partial_loop' | 'spur'
  routeTypeLabel?: string
  warnings?: Array<{ code: string; message: string; severity: 'info' | 'warning' | 'error' }>
  title: string
  reason: string
  steps: string[]
  path: LatLngTuple[]
  legs?: Array<{
    index: number
    fromNodeId: string
    toNodeId: string
    mode: 'outbound' | 'return'
    path: LatLngTuple[]
    distance: number
    time: number
  }>
  segments?: Array<{
    segmentId: string
    order: number
    role: 'approach' | 'main_edge' | 'connector' | 'return' | 'loop_closure' | 'spur_out' | 'spur_back'
    fromNodeId: string
    toNodeId: string
    edgeId?: string
    source: 'TMAP' | 'OSM' | 'MIXED'
    path: LatLngTuple[]
    distanceM: number
    durationSec?: number
    isRecommendedEdge: boolean
  }>
  turnNodeId?: string | null
  distance: number
  time: number | null
}

interface RecommendationDemoProps {
  status: 'loading' | 'ready' | 'error'
  error?: string
  onBack: () => void
}

const DEFAULT_START = { lat: 36.3672, lng: 127.3892 }
const START_COLOR = '#ef4444'
const NODE_COLOR = '#8b5cf6'
const OUTBOUND_COLOR = '#f59e0b'
const RETURN_COLOR = '#2563eb'
const END_COLOR = '#0f172a'
const ROUTE_PREFERENCES: Array<{
  id: RoutePreference
  label: string
  description: string
}> = [
  { id: 'round_trip', label: '왕복', description: '출발지 근처로 돌아오는 산책' },
  { id: 'one_way', label: '편도', description: '선택한 산책 구간 끝에서 종료' },
]
const WALK_THEMES: WalkTheme[] = [
  {
    id: 'river-calm',
    label: '하천 따라 조용히',
    keywords: ['하천변', '조용함', '평탄함'],
    preferredTags: ['river', 'gapcheon', 'open-view', 'flat', 'walkable'],
    prompt: '갑천처럼 물길을 따라 걷는 느낌이 강하고, 조용하며 평탄한 산책 노드를 우선 선택한다.',
  },
  {
    id: 'park-loop',
    label: '공원 안 순환',
    keywords: ['공원', '순환', '짧은 산책'],
    preferredTags: ['park', 'arboretum', 'loop', 'quiet', 'short'],
    prompt: '공원 내부 산책로처럼 돌아오기 쉽고, 짧게 순환 산책하기 좋은 노드를 우선 선택한다.',
  },
  {
    id: 'open-long',
    label: '탁 트인 긴 산책',
    keywords: ['개방감', '긴 산책', '경관'],
    preferredTags: ['open-view', 'long', 'river', 'gapcheon', 'paved'],
    prompt: '시야가 트이고 조금 길게 걸을 수 있는 산책로 노드를 우선 선택한다.',
  },
]

function uniqueTags(tags: string[]) {
  return [...new Set(tags)]
}

function inferOsmWalkTags(walk: typeof OSM_GAPCHEON_WALKS[number]) {
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

function inferTmapWalkTags(walk: typeof TMAP_ARBORETUM_WALKS[number]) {
  const tags = ['park', 'arboretum', 'quiet', 'loop', 'pedestrian', 'walkable']
  if ((walk.distance ?? walk.osmLength) <= 250) tags.push('short', 'connector')
  if ((walk.distance ?? walk.osmLength) > 250) tags.push('medium')
  if ((walk.distance ?? walk.osmLength) >= 500) tags.push('long')
  return uniqueTags(tags)
}

function describeTags(tags: string[], routeName: string) {
  const phrases = []
  if (tags.includes('river')) phrases.push('하천변')
  if (tags.includes('park')) phrases.push('공원 내부')
  if (tags.includes('quiet')) phrases.push('조용한 산책')
  if (tags.includes('open-view')) phrases.push('개방감')
  if (tags.includes('loop')) phrases.push('순환 산책')
  if (tags.includes('flat')) phrases.push('평탄한 포장로')
  if (tags.includes('shared-bike')) phrases.push('자전거 겸용')
  return `${routeName} - ${phrases.join(', ') || '산책 후보 구간'}`
}

function safeSetMap(target: { setMap: (map: Tmapv2.Map | null) => void } | null, map: Tmapv2.Map | null) {
  try {
    target?.setMap(map)
  } catch {
    // TMAP SDK can throw while React dev mode remounts map shapes.
  }
}

function markerDataUrl(color: string, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="38" viewBox="0 0 30 38">
    <path d="M15 0C7.2 0 1 6.2 1 14c0 9.2 14 24 14 24s14-14.8 14-24C29 6.2 22.8 0 15 0z" fill="${color}" stroke="#ffffff" stroke-width="2"/>
    <circle cx="15" cy="14" r="8" fill="#ffffff"/>
    <text x="15" y="18" font-size="10" text-anchor="middle" fill="${color}" font-family="Arial" font-weight="700">${label}</text>
  </svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function dotDataUrl(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12">
    <circle cx="6" cy="6" r="4" fill="${color}" stroke="#ffffff" stroke-width="1.5"/>
  </svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function arrowDataUrl(color: string, label: string, angle: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38">
    <circle cx="19" cy="19" r="16" fill="${color}" stroke="#ffffff" stroke-width="3"/>
    <path d="M19 8l8 12h-5v9h-6v-9h-5z" fill="#ffffff" transform="rotate(${angle} 19 19)"/>
    <circle cx="30" cy="8" r="8" fill="#111827" stroke="#ffffff" stroke-width="2"/>
    <text x="30" y="12" font-size="9" text-anchor="middle" fill="#ffffff" font-family="Arial" font-weight="700">${label}</text>
  </svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180
  const lat1 = a.lat * rad
  const lat2 = b.lat * rad
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function bearingDegrees(from: LatLngTuple, to: LatLngTuple) {
  const rad = Math.PI / 180
  const lat1 = from[0] * rad
  const lat2 = to[0] * rad
  const dLng = (to[1] - from[1]) * rad
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

function routePointAtRatio(path: LatLngTuple[], ratio: number) {
  if (path.length < 2) return null
  const legs = path.slice(1).map((point, index) => ({
    from: path[index],
    to: point,
    distance: distanceMeters(
      { lat: path[index][0], lng: path[index][1] },
      { lat: point[0], lng: point[1] },
    ),
  }))
  const total = legs.reduce((sum, leg) => sum + leg.distance, 0)
  if (total <= 0) return null

  let walked = 0
  const target = total * ratio
  for (const leg of legs) {
    if (walked + leg.distance >= target) {
      const legRatio = leg.distance === 0 ? 0 : (target - walked) / leg.distance
      return {
        point: [
          leg.from[0] + (leg.to[0] - leg.from[0]) * legRatio,
          leg.from[1] + (leg.to[1] - leg.from[1]) * legRatio,
        ] as LatLngTuple,
        angle: bearingDegrees(leg.from, leg.to),
      }
    }
    walked += leg.distance
  }
  return {
    point: path[path.length - 1],
    angle: bearingDegrees(path[path.length - 2], path[path.length - 1]),
  }
}

function latLngToWorld(lat: number, lng: number, zoom: number) {
  const sinLat = Math.sin((lat * Math.PI) / 180)
  const scale = 256 * 2 ** zoom
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
  }
}

function worldToLatLng(x: number, y: number, zoom: number) {
  const scale = 256 * 2 ** zoom
  const lng = (x / scale) * 360 - 180
  const n = Math.PI - (2 * Math.PI * y) / scale
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
  return { lat, lng }
}

function domClickToLatLng(event: MouseEvent, map: Tmapv2.Map, container: HTMLDivElement) {
  const center = map.getCenter()
  const rect = container.getBoundingClientRect()
  const zoom = map.getZoom()
  const centerWorld = latLngToWorld(center.lat(), center.lng(), zoom)
  return worldToLatLng(
    centerWorld.x + event.clientX - rect.left - rect.width / 2,
    centerWorld.y + event.clientY - rect.top - rect.height / 2,
    zoom,
  )
}

function buildAllNodes(): WalkNode[] {
  const byKey = new Map<string, WalkNode>()
  const add = (node: WalkNode) => {
    const key = `${node.lat.toFixed(5)},${node.lng.toFixed(5)}`
    if (!byKey.has(key)) byKey.set(key, node)
  }

  OSM_GAPCHEON_WALKS
    .filter((walk) => walk.length >= 40)
    .slice(0, 220)
    .forEach((walk) => {
      const tags = inferOsmWalkTags(walk)
      walk.nodes.forEach((node, index) => {
        if (index % Math.max(1, Math.floor(walk.nodes.length / 12)) !== 0) return
        add({
          id: `osm-${walk.osmId}-${index}`,
          lat: node.lat,
          lng: node.lng,
          source: 'OSM',
          label: `${walk.highway} node ${index + 1}`,
          routeName: walk.name,
          tags,
          description: describeTags(tags, walk.name),
        })
      })
    })

  TMAP_ARBORETUM_WALKS.forEach((walk) => {
    const tags = inferTmapWalkTags(walk)
    walk.path.forEach(([lat, lng], index) => {
      if (index % Math.max(1, Math.floor(walk.path.length / 8)) !== 0) return
      add({
        id: `tmap-${walk.id}-${index}`,
        lat,
        lng,
        source: 'TMAP',
        label: `TMAP node ${index + 1}`,
        routeName: walk.name,
        tags,
        description: describeTags(tags, walk.name),
      })
    })
  })

  return [...byKey.values()]
}

function nearestNodes(nodes: WalkNode[], start: { lat: number; lng: number }) {
  return nodes
    .map((node) => ({
      ...node,
      distanceFromStart: Math.round(distanceMeters(start, node)),
    }))
    .sort((a, b) => a.distanceFromStart - b.distanceFromStart)
    .slice(0, 90)
}

function buildCandidateEdges(start: { lat: number; lng: number }): WalkEdgeCandidate[] {
  return OSM_WALK_EDGES
    .filter((edge) => edge.length >= 30)
    .map((edge) => {
      const fromPoint = edge.nodes[0]
      const toPoint = edge.nodes[edge.nodes.length - 1]
      const from = { lat: fromPoint.lat, lng: fromPoint.lng }
      const to = { lat: toPoint.lat, lng: toPoint.lng }
      const entryDistance = Math.round(distanceMeters(start, from))
      const exitDistance = Math.round(distanceMeters(start, to))
      const isRiverCorridor =
        edge.length >= 700 ||
        (edge.length >= 350 && (edge.tags.highway === 'cycleway' || edge.tags.highway === 'path'))
      const tags = uniqueTags([
        ...edge.routeTypeHints,
        isRiverCorridor ? 'river' : '',
        isRiverCorridor ? 'gapcheon' : '',
        isRiverCorridor ? 'river-corridor' : '',
        'walkable',
        edge.tags.highway,
        edge.tags.surface,
        edge.tags.foot === 'designated' || edge.tags.foot === 'yes' ? 'pedestrian' : '',
        edge.tags.bicycle === 'designated' || edge.tags.highway === 'cycleway' ? 'shared-bike' : '',
      ].filter(Boolean) as string[])
      return {
        edgeId: edge.id,
        source: 'OSM' as const,
        routeName: edge.tags.name || edge.id,
        fromNodeId: edge.from,
        toNodeId: edge.to,
        from,
        to,
        nodes: edge.nodes.map((node) => [node.lat, node.lng] as LatLngTuple),
        distanceM: Math.round(edge.length),
        tags,
        description: `${edge.tags.name || 'OSM edge'} - ${tags.join(', ')}`,
        distanceFromStart: Math.min(entryDistance, exitDistance),
        entryDistance,
        exitDistance,
      }
    })
    .sort((a, b) => a.distanceFromStart - b.distanceFromStart)
    .slice(0, 60)
}

export function RecommendationDemo({ status, error, onBack }: RecommendationDemoProps) {
  const mapEl = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Tmapv2.Map | null>(null)
  const startMarkerRef = useRef<Tmapv2.Marker | null>(null)
  const routeLinesRef = useRef<Tmapv2.Polyline[]>([])
  const nodeMarkersRef = useRef<Tmapv2.Marker[]>([])
  const shouldPanRef = useRef(false)

  const [start, setStart] = useState(DEFAULT_START)
  const [manualLat, setManualLat] = useState(String(DEFAULT_START.lat))
  const [manualLng, setManualLng] = useState(String(DEFAULT_START.lng))
  const [targetDistance, setTargetDistance] = useState(1200)
  const [routePreference, setRoutePreference] = useState<RoutePreference>('round_trip')
  const [selectedThemeId, setSelectedThemeId] = useState(WALK_THEMES[0].id)
  const [result, setResult] = useState<LlmRouteResult | null>(null)
  const [apiStatus, setApiStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [apiError, setApiError] = useState('')

  const allNodes = useMemo(buildAllNodes, [])
  const candidateNodes = useMemo(() => nearestNodes(allNodes, start), [allNodes, start])
  const candidateEdges = useMemo(() => buildCandidateEdges(start), [start])
  const selectedTheme = useMemo(
    () => WALK_THEMES.find((theme) => theme.id === selectedThemeId) ?? WALK_THEMES[0],
    [selectedThemeId],
  )
  const selectedNodes = useMemo(
    () => result ? result.nodeIds.map((id) => candidateNodes.find((node) => node.id === id)).filter(Boolean) as WalkNode[] : [],
    [candidateNodes, result],
  )
  const routeGuide = useMemo(() => {
    if (!result?.legs?.length) return []
    const nodeById = new Map(selectedNodes.map((node) => [node.id, node]))
    return [...result.legs]
      .sort((a, b) => a.index - b.index)
      .map((leg) => ({
        ...leg,
        fromLabel: leg.fromNodeId === 'start' ? '시작점' : nodeById.get(leg.fromNodeId)?.label ?? leg.fromNodeId,
        toLabel: nodeById.get(leg.toNodeId)?.label ?? leg.toNodeId,
      }))
  }, [result, selectedNodes])

  const setStartPoint = (next: { lat: number; lng: number }, pan = true) => {
    const fixed = { lat: Number(next.lat.toFixed(6)), lng: Number(next.lng.toFixed(6)) }
    shouldPanRef.current = pan
    setStart(fixed)
    setManualLat(String(fixed.lat))
    setManualLng(String(fixed.lng))
    setResult(null)
  }

  useEffect(() => {
    if (status !== 'ready' || !mapEl.current || !window.Tmapv2 || mapRef.current) return
    const T = window.Tmapv2
    const map = new T.Map(mapEl.current, {
      center: new T.LatLng(DEFAULT_START.lat, DEFAULT_START.lng),
      zoom: 15,
      width: '100%',
      height: '100%',
      zoomControl: true,
      scrollwheel: true,
    })
    const handleDomContextMenu = (event: MouseEvent) => {
      event.preventDefault()
      setStartPoint(domClickToLatLng(event, map, mapEl.current!), false)
    }
    mapEl.current.addEventListener('contextmenu', handleDomContextMenu, true)
    mapRef.current = map

    return () => {
      mapEl.current?.removeEventListener('contextmenu', handleDomContextMenu, true)
      safeSetMap(startMarkerRef.current, null)
      routeLinesRef.current.forEach((line) => safeSetMap(line, null))
      routeLinesRef.current = []
      nodeMarkersRef.current.forEach((marker) => safeSetMap(marker, null))
      nodeMarkersRef.current = []
      try {
        map.destroy?.()
      } catch {
        // Ignore SDK cleanup errors.
      }
      mapRef.current = null
    }
  }, [status])

  useEffect(() => {
    const map = mapRef.current
    const T = window.Tmapv2
    if (!map || !T) return

    safeSetMap(startMarkerRef.current, null)
    routeLinesRef.current.forEach((line) => safeSetMap(line, null))
    routeLinesRef.current = []
    nodeMarkersRef.current.forEach((marker) => safeSetMap(marker, null))
    nodeMarkersRef.current = []

    startMarkerRef.current = new T.Marker({
      position: new T.LatLng(start.lat, start.lng),
      icon: markerDataUrl(START_COLOR, 'S'),
      iconSize: new T.Size(30, 38),
      title: '선택한 시작점',
      map,
    })

    if (result?.path?.length) {
      const drawableLegs = result.segments?.length
        ? result.segments.map((segment) => ({
            index: segment.order,
            mode: segment.role === 'return' || segment.role === 'spur_back' ? 'return' as const : 'outbound' as const,
            path: segment.path,
            distance: segment.distanceM,
            time: segment.durationSec ?? 0,
            fromNodeId: segment.fromNodeId,
            toNodeId: segment.toNodeId,
          }))
        : result.legs?.length
          ? [...result.legs].sort((a, b) => a.index - b.index)
        : [{ index: 0, mode: 'outbound' as const, path: result.path }]
      const outboundLegs = drawableLegs.filter((leg) => leg.mode === 'outbound')
      const returnLegs = drawableLegs.filter((leg) => leg.mode === 'return')
      routeLinesRef.current = [...outboundLegs, ...returnLegs].map((leg) => new T.Polyline({
        path: leg.path.map(([lat, lng]) => new T.LatLng(lat, lng)),
        strokeColor: leg.mode === 'return' ? RETURN_COLOR : OUTBOUND_COLOR,
        strokeWeight: leg.mode === 'return' ? 8 : 7,
        strokeOpacity: leg.mode === 'return' ? 0.9 : 0.95,
        strokeStyle: leg.mode === 'return' ? 'dash' : 'solid',
        map,
      }))

      nodeMarkersRef.current = [
        ...selectedNodes.map((node, index) => new T.Marker({
          position: new T.LatLng(node.lat, node.lng),
          icon: markerDataUrl(
            node.id === result.turnNodeId ? RETURN_COLOR : index === selectedNodes.length - 1 ? END_COLOR : NODE_COLOR,
            node.id === result.turnNodeId ? 'R' : String(index + 1),
          ),
          iconSize: new T.Size(30, 38),
          title: node.id === result.turnNodeId ? `반환점: ${node.label}` : `${index + 1}. ${node.label}`,
          map,
        })),
        ...drawableLegs.flatMap((leg) => {
          const arrow = routePointAtRatio(leg.path, 0.6)
          if (!arrow) return []
          return [new T.Marker({
            position: new T.LatLng(arrow.point[0], arrow.point[1]),
            icon: arrowDataUrl(leg.mode === 'return' ? RETURN_COLOR : OUTBOUND_COLOR, String(leg.index + 1), arrow.angle),
            iconSize: new T.Size(38, 38),
            title: `${leg.index + 1}구간 ${leg.mode === 'return' ? '오는길' : '가는길'}`,
            map,
          })]
        }),
      ]
    } else {
      const nodeIcon = dotDataUrl(NODE_COLOR)
      nodeMarkersRef.current = candidateNodes.slice(0, 40).map((node) => new T.Marker({
        position: new T.LatLng(node.lat, node.lng),
        icon: nodeIcon,
        iconSize: new T.Size(12, 12),
        title: node.label,
        map,
      }))
    }

    if (shouldPanRef.current) map.setCenter(new T.LatLng(start.lat, start.lng))
    shouldPanRef.current = false
  }, [candidateNodes, result, start])

  const applyManualStart = () => {
    const lat = Number(manualLat)
    const lng = Number(manualLng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setApiStatus('error')
      setApiError('위도와 경도를 숫자로 입력하세요.')
      return
    }
    setStartPoint({ lat, lng })
  }

  const callLlm = async () => {
    setApiStatus('loading')
    setApiError('')
    setResult(null)
    try {
      const res = await fetch('/api/recommend-walk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start,
          targetDistance,
          routePreference,
          theme: selectedTheme,
          nodes: candidateNodes.map((node) => ({
            nodeId: node.id,
            lat: node.lat,
            lng: node.lng,
            source: node.source,
            label: node.label,
            routeName: node.routeName,
            tags: node.tags,
            description: node.description,
            distanceFromStart: node.distanceFromStart,
          })),
          edges: candidateEdges,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'LLM 추천 API 호출 실패')
      setResult(json)
      setApiStatus('idle')
    } catch (err) {
      setApiStatus('error')
      setApiError(err instanceof Error ? err.message : 'LLM 추천 API 호출 실패')
    }
  }

  const routePreferenceLabel = ROUTE_PREFERENCES.find((item) => item.id === routePreference)?.label ?? routePreference
  const prompt = `${selectedTheme.label}: ${selectedTheme.prompt} 현재 위치 ${start.lat.toFixed(6)}, ${start.lng.toFixed(6)} 주변 edge 중 ${routePreferenceLabel} 형태로 목표 ${targetDistance.toLocaleString()}m에 맞는 산책 edge를 골라줘.`

  return (
    <div className="recommend-layout">
      <aside className="recommend-panel">
        <div className="recommend-head">
          <button type="button" className="ghost-button" onClick={onBack}>← 지도</button>
          <div>
            <h1>LLM 산책 추천 데모</h1>
            <p>LLM이 주변 노드 리스트를 직접 고르고, TMAP이 선택된 노드 사이를 보행 경로로 연결합니다.</p>
          </div>
        </div>

        <section className="recommend-section">
          <h2>입력</h2>
          <label className="field">
            <span>목표 거리</span>
            <select
              value={targetDistance}
              onChange={(event) => {
                setTargetDistance(Number(event.target.value))
                setResult(null)
              }}
            >
              <option value={600}>600m</option>
              <option value={1200}>1.2km</option>
              <option value={2000}>2km</option>
              <option value={3000}>3km</option>
            </select>
          </label>
          <div className="field">
            <span>코스 형태</span>
            <div className="theme-button-grid compact" role="group" aria-label="코스 형태 선택">
              {ROUTE_PREFERENCES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={routePreference === item.id ? 'active' : ''}
                  onClick={() => {
                    setRoutePreference(item.id)
                    setResult(null)
                  }}
                >
                  <b>{item.label}</b>
                  <span>{item.description}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="manual-grid">
            <label className="field">
              <span>위도</span>
              <input value={manualLat} onChange={(event) => setManualLat(event.target.value)} />
            </label>
            <label className="field">
              <span>경도</span>
              <input value={manualLng} onChange={(event) => setManualLng(event.target.value)} />
            </label>
          </div>
          <button type="button" className="primary-button" onClick={applyManualStart}>좌표 적용</button>
          <div className="coord-row">
            <span>{start.lat.toFixed(6)}</span>
            <span>{start.lng.toFixed(6)}</span>
          </div>
          <div className="preset-row">
            <button type="button" onClick={() => setStartPoint({ lat: 36.3672, lng: 127.3892 })}>한밭수목원</button>
            <button type="button" onClick={() => setStartPoint({ lat: 36.3705, lng: 127.3792 })}>갑천 서측</button>
          </div>
        </section>

        <section className="recommend-section">
          <h2>LLM 입력</h2>
          <div className="theme-button-grid" role="group" aria-label="산책 키워드 선택">
            {WALK_THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                className={theme.id === selectedThemeId ? 'active' : ''}
                onClick={() => {
                  setSelectedThemeId(theme.id)
                  setResult(null)
                }}
              >
                <b>{theme.label}</b>
                <span>{theme.keywords.join(' · ')}</span>
              </button>
            ))}
          </div>
          <p className="prompt-text">{prompt}</p>
          <div className="metric-grid">
            <span><b>{candidateNodes.length}</b> 후보 노드</span>
            <span><b>{candidateEdges.length}</b> 후보 edge</span>
            <span><b>{candidateNodes[0]?.distanceFromStart ?? 0}m</b> 최근접 노드</span>
          </div>
          <details className="node-tag-details">
            <summary>후보 노드 태그 보기</summary>
            <div className="node-tag-list">
              {candidateNodes.slice(0, 20).map((node) => (
                <article key={node.id} className="node-tag-card">
                  <div>
                    <b>{node.label}</b>
                    <span>{node.source} · {node.distanceFromStart}m · {node.routeName}</span>
                  </div>
                  <p>{node.description}</p>
                  <div className="mini-tag-row">
                    {node.tags.map((tag) => <i key={tag}>{tag}</i>)}
                  </div>
                </article>
              ))}
            </div>
          </details>
          <button type="button" className="primary-button" onClick={callLlm} disabled={apiStatus === 'loading'}>
            {apiStatus === 'loading' ? 'LLM + TMAP 호출 중…' : 'LLM 추천 호출'}
          </button>
          {apiStatus === 'error' && <p className="api-error">{apiError}</p>}
        </section>

        <section className="recommend-section result">
          <h2>{result ? 'LLM 추천 결과' : '추천 대기'}</h2>
          {result ? (
            <>
              <strong>{result.title}</strong>
              <div className="metric-grid">
                <span><b>{Math.round(result.distance).toLocaleString()}m</b> 추천 경로</span>
                <span><b>{selectedNodes.length}</b> 선택 노드</span>
                <span><b>{result.edgeIds?.length ?? 0}</b> 선택 edge</span>
                <span><b>{result.routeTypeLabel ?? result.routeType ?? '-'}</b> 코스 타입</span>
                <span><b>{result.time != null ? `${Math.round(result.time / 60)}분` : '-'}</b> 예상 시간</span>
                <span><b>{Math.abs(Math.round(result.distance - targetDistance)).toLocaleString()}m</b> 목표 차이</span>
              </div>
              <p>{result.reason}</p>
              {result.warnings?.length ? (
                <ul className="warning-list">
                  {result.warnings.map((warning) => (
                    <li key={`${warning.code}-${warning.message}`} className={warning.severity}>
                      {warning.message}
                    </li>
                  ))}
                </ul>
              ) : null}
              {result.steps?.length ? (
                <ol className="step-list">
                  {result.steps.map((step) => <li key={step}>{step}</li>)}
                </ol>
              ) : null}
              {routeGuide.length ? (
                <ol className="route-guide-list">
                  {routeGuide.map((leg) => (
                    <li key={`${leg.index}-${leg.toNodeId}`} className={leg.mode}>
                      <b>{leg.mode === 'return' ? '오는길' : '가는길'} {leg.index + 1}</b>
                      <span>{leg.fromLabel} → {leg.toLabel}</span>
                      <em>{Math.round(leg.distance).toLocaleString()}m</em>
                    </li>
                  ))}
                </ol>
              ) : null}
              <div className="tag-row">
                {selectedNodes.map((node) => <span key={node.id}>{node.label} · {node.tags.join(', ')}</span>)}
              </div>
            </>
          ) : (
            <p>시작점과 목표 거리를 정한 뒤 호출하세요. LLM이 edge를 고르면 OSM 본선과 TMAP 접근/복귀 구간으로 연결합니다.</p>
          )}
        </section>
      </aside>

      <main className="recommend-map">
        {status === 'ready' && <div ref={mapEl} className="map-canvas" />}
        {result && (
          <div className="route-legend" aria-label="경로 범례">
            <span><i className="legend-line outbound" />가는길</span>
            <span><i className="legend-line return" />오는길</span>
            <span><i className="legend-pin">R</i>반환점</span>
          </div>
        )}
        {status === 'loading' && (
          <div className="map-state">
            <div className="spinner" />
            <p>TMAP 지도 SDK 로딩 중…</p>
          </div>
        )}
        {status === 'error' && (
          <div className="map-state error">
            <h2>지도를 불러오지 못했습니다</h2>
            <p>{error}</p>
          </div>
        )}
      </main>
    </div>
  )
}
