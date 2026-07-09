import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function readJsonBody(req: import('node:http').IncomingMessage) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 1_000_000) {
        reject(new Error('요청 본문이 너무 큽니다.'))
        req.destroy()
      }
    })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch {
        reject(new Error('JSON 요청만 지원합니다.'))
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res: import('node:http').ServerResponse, status: number, data: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}

function parseJsonFromModel(text: string) {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  return JSON.parse((fenced?.[1] ?? trimmed).trim())
}

interface ApiNode {
  nodeId: string
  lat: number
  lng: number
  label?: string
  routeName?: string
  tags?: string[]
  description?: string
  distanceFromStart?: number
}

interface ApiEdge {
  edgeId: string
  source?: 'OSM' | 'TMAP'
  routeName?: string
  fromNodeId: string
  toNodeId: string
  from: { lat: number; lng: number }
  to: { lat: number; lng: number }
  nodes?: [number, number][]
  distanceM: number
  tags?: string[]
  description?: string
  distanceFromStart?: number
  entryDistance?: number
  exitDistance?: number
}

interface WalkTheme {
  id?: string
  label?: string
  keywords?: string[]
  preferredTags?: string[]
  prompt?: string
}

type RoutePreference = 'round_trip' | 'one_way'

interface TmapRoute {
  path: [number, number][]
  distance: number
  time: number
}

type RouteCache = Map<string, TmapRoute>

function routeCacheKey(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
) {
  return `${start.lat.toFixed(6)},${start.lng.toFixed(6)}>${end.lat.toFixed(6)},${end.lng.toFixed(6)}`
}

async function fetchTmapPedestrian(
  appKey: string,
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
) {
  const body = {
    startX: String(start.lng),
    startY: String(start.lat),
    endX: String(end.lng),
    endY: String(end.lat),
    startName: '출발',
    endName: '도착',
    reqCoordType: 'WGS84GEO',
    resCoordType: 'WGS84GEO',
    searchOption: '0',
  }

  const res = await fetch('https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json', {
    method: 'POST',
    headers: { appKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`TMAP 보행자 경로 API 오류 ${res.status}: ${(await res.text()).slice(0, 300)}`)

  const json = await res.json() as {
    features?: Array<{
      geometry?: { type?: string; coordinates?: [number, number][] }
      properties?: { totalDistance?: number; totalTime?: number }
    }>
  }
  const path: [number, number][] = []
  let distance = 0
  let time = 0
  for (const feature of json.features ?? []) {
    const props = feature.properties ?? {}
    if (props.totalDistance != null && distance === 0) {
      distance = props.totalDistance
      time = props.totalTime ?? 0
    }
    if (feature.geometry?.type === 'LineString' && feature.geometry.coordinates) {
      for (const [lng, lat] of feature.geometry.coordinates) {
        const point: [number, number] = [Number(lat.toFixed(6)), Number(lng.toFixed(6))]
        const last = path[path.length - 1]
        if (!last || last[0] !== point[0] || last[1] !== point[1]) path.push(point)
      }
    }
  }
  if (path.length < 2) throw new Error('TMAP 경로 좌표가 부족합니다.')
  return { path, distance, time }
}

async function getTmapRoute(
  appKey: string,
  cache: RouteCache,
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
) {
  const key = routeCacheKey(start, end)
  const cached = cache.get(key)
  if (cached) return cached
  const route = await fetchTmapPedestrian(appKey, start, end)
  cache.set(key, route)
  return route
}

async function reorderNodesForWalk(
  appKey: string,
  cache: RouteCache,
  start: { lat: number; lng: number },
  nodes: ApiNode[],
  targetDistance: number,
) {
  const remaining = [...nodes]
  const ordered: ApiNode[] = []
  let current = start
  let walkedDistance = 0
  const maxLegDistance = Math.max(450, Math.min(1200, targetDistance * 0.45))

  while (remaining.length > 0) {
    const candidates = await Promise.all(
      remaining.map(async (node) => {
        const route = await getTmapRoute(appKey, cache, current, node)
        const longJumpPenalty = route.distance > maxLegDistance ? (route.distance - maxLegDistance) * 3 : 0
        const overshootPenalty = walkedDistance + route.distance > targetDistance * 1.25
          ? (walkedDistance + route.distance - targetDistance * 1.25) * 2
          : 0
        return { node, route, score: route.distance + longJumpPenalty + overshootPenalty }
      }),
    )

    candidates.sort((a, b) => a.score - b.score)
    const next = candidates[0]
    if (!next) break

    const nextIndex = remaining.findIndex((node) => node.nodeId === next.node.nodeId)
    remaining.splice(nextIndex, 1)

    if (ordered.length > 0 && next.route.distance > maxLegDistance && walkedDistance >= targetDistance * 0.55) {
      break
    }

    ordered.push(next.node)
    walkedDistance += next.route.distance
    current = next.node

    if (walkedDistance >= targetDistance * 0.9 && ordered.length >= 3) break
  }

  return ordered.length > 0 ? ordered : nodes.slice(0, 1)
}

async function connectNodesWithTmap(
  appKey: string,
  cache: RouteCache,
  start: { lat: number; lng: number },
  nodes: ApiNode[],
) {
  const stops = [start, ...nodes.map((node) => ({ lat: node.lat, lng: node.lng }))]
  const turnStopIndex = stops
    .map((stop, index) => ({
      index,
      distance:
        Math.hypot((stop.lat - start.lat) * 111_000, (stop.lng - start.lng) * 88_000),
    }))
    .sort((a, b) => b.distance - a.distance)[0]?.index ?? stops.length - 1
  const fullPath: [number, number][] = []
  const legs: Array<{
    index: number
    fromNodeId: string
    toNodeId: string
    mode: 'outbound' | 'return'
    path: [number, number][]
    distance: number
    time: number
  }> = []
  let totalDistance = 0
  let totalTime = 0

  for (let i = 1; i < stops.length; i++) {
    const route = await getTmapRoute(appKey, cache, stops[i - 1], stops[i])
    totalDistance += route.distance
    totalTime += route.time
    for (const point of route.path) {
      const last = fullPath[fullPath.length - 1]
      if (!last || last[0] !== point[0] || last[1] !== point[1]) fullPath.push(point)
    }
    legs.push({
      index: i - 1,
      fromNodeId: i === 1 ? 'start' : nodes[i - 2].nodeId,
      toNodeId: nodes[i - 1].nodeId,
      mode: i - 1 < turnStopIndex ? 'outbound' : 'return',
      path: route.path,
      distance: route.distance,
      time: route.time,
    })
  }

  return {
    path: fullPath,
    legs,
    turnNodeId: turnStopIndex > 0 ? nodes[turnStopIndex - 1]?.nodeId : null,
    distance: totalDistance,
    time: totalTime,
  }
}

function routeTypeLabel(routeType: string) {
  const labels: Record<string, string> = {
    one_way: '편도형',
    simple_round_trip: '단순 왕복형',
    loop: '순환형',
    partial_loop: '부분 순환형',
    spur: '경유형',
  }
  return labels[routeType] ?? routeType
}

type RouteSegment = {
  segmentId: string
  order: number
  role: 'approach' | 'main_edge' | 'connector' | 'return' | 'loop_closure' | 'spur_out' | 'spur_back'
  fromNodeId: string
  toNodeId: string
  edgeId?: string
  source: 'TMAP' | 'OSM' | 'MIXED'
  path: [number, number][]
  distanceM: number
  durationSec?: number
  isRecommendedEdge: boolean
}

function approxMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  return Math.hypot((a.lat - b.lat) * 111_000, (a.lng - b.lng) * 88_000)
}

function pathDistance(path: [number, number][]) {
  let total = 0
  for (let i = 1; i < path.length; i++) {
    total += approxMeters(
      { lat: path[i - 1][0], lng: path[i - 1][1] },
      { lat: path[i][0], lng: path[i][1] },
    )
  }
  return total
}

function slicePathByDistance(path: [number, number][], maxDistance: number) {
  if (path.length < 2 || maxDistance <= 0) return path.slice(0, 1)
  const sliced: [number, number][] = [path[0]]
  let walked = 0
  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1]
    const to = path[i]
    const leg = approxMeters({ lat: from[0], lng: from[1] }, { lat: to[0], lng: to[1] })
    if (walked + leg >= maxDistance) {
      const ratio = leg === 0 ? 0 : (maxDistance - walked) / leg
      sliced.push([
        Number((from[0] + (to[0] - from[0]) * ratio).toFixed(6)),
        Number((from[1] + (to[1] - from[1]) * ratio).toFixed(6)),
      ])
      return sliced
    }
    sliced.push(to)
    walked += leg
  }
  return sliced
}

async function connectEdgesWithTmap(
  appKey: string,
  cache: RouteCache,
  start: { lat: number; lng: number },
  edges: ApiEdge[],
  targetDistance: number,
  routePreference: RoutePreference,
) {
  const edge = edges
    .filter((candidate) => Array.isArray(candidate.nodes) && candidate.nodes.length >= 2)
    .sort((a, b) => (a.distanceFromStart ?? 999999) - (b.distanceFromStart ?? 999999))[0]
  if (!edge) throw new Error('LLM이 유효한 edgeIds를 반환하지 않았습니다.')

  const useReverse = (edge.exitDistance ?? 0) < (edge.entryDistance ?? 0)
  const entry = useReverse ? edge.to : edge.from
  const exit = useReverse ? edge.from : edge.to
  const mainPath = useReverse ? [...(edge.nodes ?? [])].reverse() : [...(edge.nodes ?? [])]
  const approach = await getTmapRoute(appKey, cache, start, entry)
  const returning = routePreference === 'round_trip'
    ? await getTmapRoute(appKey, cache, exit, start)
    : null

  const segments = [
    {
      segmentId: 'approach-0',
      order: 0,
      role: 'approach',
      fromNodeId: 'start',
      toNodeId: useReverse ? edge.toNodeId : edge.fromNodeId,
      source: 'TMAP',
      path: approach.path,
      distanceM: approach.distance,
      durationSec: approach.time,
      isRecommendedEdge: false,
    },
    {
      segmentId: `main-${edge.edgeId}`,
      order: 1,
      role: 'main_edge',
      fromNodeId: useReverse ? edge.toNodeId : edge.fromNodeId,
      toNodeId: useReverse ? edge.fromNodeId : edge.toNodeId,
      edgeId: edge.edgeId,
      source: 'OSM',
      path: mainPath,
      distanceM: edge.distanceM,
      durationSec: Math.round((edge.distanceM / 4000) * 3600),
      isRecommendedEdge: true,
    },
  ]

  if (returning) {
    segments.push({
      segmentId: 'return-0',
      order: 2,
      role: 'return',
      fromNodeId: useReverse ? edge.fromNodeId : edge.toNodeId,
      toNodeId: 'start',
      source: 'TMAP',
      path: returning.path,
      distanceM: returning.distance,
      durationSec: returning.time,
      isRecommendedEdge: false,
    })
  }

  const fullPath: [number, number][] = []
  let distance = 0
  let time = 0
  for (const segment of segments) {
    distance += segment.distanceM
    time += segment.durationSec ?? 0
    for (const point of segment.path) {
      const last = fullPath[fullPath.length - 1]
      if (!last || last[0] !== point[0] || last[1] !== point[1]) fullPath.push(point)
    }
  }

  const warnings: Array<{ code: string; message: string; severity: 'info' | 'warning' | 'error' }> = []
  if (distance < targetDistance * 0.75 || distance > targetDistance * 1.3) {
    warnings.push({
      code: 'distance_out_of_tolerance',
      message: `목표 거리와 차이가 큽니다. 목표 ${Math.round(targetDistance)}m, 추천 ${Math.round(distance)}m입니다.`,
      severity: 'warning',
    })
  }
  if (returning && returning.distance > Math.max(900, targetDistance * 0.7)) {
    warnings.push({
      code: 'tmap_detour_high',
      message: '복귀 구간이 길어 부분 순환형보다는 이동 목적 경로처럼 보일 수 있습니다.',
      severity: 'warning',
    })
  }

  const routeType = routePreference === 'one_way'
    ? 'one_way'
    : returning && returning.distance < approach.distance * 1.8 ? 'partial_loop' : 'simple_round_trip'
  const legs = segments.map((segment) => ({
    index: segment.order,
    fromNodeId: segment.fromNodeId,
    toNodeId: segment.toNodeId,
    mode: segment.role === 'return' ? 'return' as const : 'outbound' as const,
    path: segment.path,
    distance: segment.distanceM,
    time: segment.durationSec ?? 0,
  }))

  return {
    routeType,
    routeTypeLabel: routeTypeLabel(routeType),
    edgeIds: [edge.edgeId],
    nodeIds: [useReverse ? edge.toNodeId : edge.fromNodeId, useReverse ? edge.fromNodeId : edge.toNodeId],
    path: fullPath,
    legs,
    segments,
    turnNodeId: useReverse ? edge.fromNodeId : edge.toNodeId,
    distance,
    time,
    warnings,
  }
}

void connectEdgesWithTmap

async function connectRiverOutAndBack(
  appKey: string,
  cache: RouteCache,
  start: { lat: number; lng: number },
  edges: ApiEdge[],
  targetDistance: number,
) {
  const riverEdges = edges.filter((edge) =>
    Array.isArray(edge.nodes) &&
    edge.nodes.length >= 2 &&
    (edge.tags?.includes('river-corridor') || edge.tags?.includes('river') || edge.tags?.includes('gapcheon')),
  )
  const candidates = riverEdges.length ? riverEdges : edges.filter((edge) => Array.isArray(edge.nodes) && edge.nodes.length >= 2)
  if (!candidates.length) throw new Error('하천 산책에 사용할 수 있는 edge가 없습니다.')

  const ranked = candidates
    .map((edge) => {
      const nearestEndpointDistance = Math.min(approxMeters(start, edge.from), approxMeters(start, edge.to))
      const geometryLength = pathDistance(edge.nodes ?? [])
      const corridorBonus = edge.tags?.includes('river-corridor') ? 900 : 0
      const longBonus = Math.min(geometryLength, targetDistance / 2) * 0.75
      const sharedRiverTrailBonus = edge.tags?.includes('shared-bike') || edge.tags?.includes('cycleway') ? 260 : 0
      const connectorPenalty = edge.tags?.includes('connector') ? 700 : 0
      const shortFootwayPenalty = edge.tags?.includes('footway') && geometryLength < 700 ? 650 : 0
      return {
        edge,
        geometryLength,
        score: nearestEndpointDistance - corridorBonus - longBonus - sharedRiverTrailBonus + connectorPenalty + shortFootwayPenalty,
      }
    })
    .sort((a, b) => a.score - b.score)
  const selected = ranked[0]
  const edge = selected.edge
  const useReverse = approxMeters(start, edge.to) < approxMeters(start, edge.from)
  const entry = useReverse ? edge.to : edge.from
  const entryNodeId = useReverse ? edge.toNodeId : edge.fromNodeId
  const rawPath = useReverse ? [...(edge.nodes ?? [])].reverse() : [...(edge.nodes ?? [])]
  const approach = await getTmapRoute(appKey, cache, start, entry)
  const targetMainDistance = Math.max(120, (targetDistance - approach.distance * 2) / 2)
  const outboundPath = slicePathByDistance(rawPath, targetMainDistance)
  const outboundDistance = pathDistance(outboundPath)
  const returnPath = [...outboundPath].reverse()
  const returnToStartPath = [...approach.path].reverse() as [number, number][]
  const endNodeId = `${entryNodeId}-turn`

  const segments: RouteSegment[] = [
    {
      segmentId: 'approach-0',
      order: 0,
      role: 'approach',
      fromNodeId: 'start',
      toNodeId: entryNodeId,
      source: 'TMAP',
      path: approach.path,
      distanceM: approach.distance,
      durationSec: approach.time,
      isRecommendedEdge: false,
    },
    {
      segmentId: `main-${edge.edgeId}`,
      order: 1,
      role: 'main_edge',
      fromNodeId: entryNodeId,
      toNodeId: endNodeId,
      edgeId: edge.edgeId,
      source: 'OSM',
      path: outboundPath,
      distanceM: outboundDistance,
      durationSec: Math.round((outboundDistance / 4000) * 3600),
      isRecommendedEdge: true,
    },
    {
      segmentId: `return-${edge.edgeId}`,
      order: 2,
      role: 'return',
      fromNodeId: endNodeId,
      toNodeId: entryNodeId,
      edgeId: edge.edgeId,
      source: 'OSM',
      path: returnPath,
      distanceM: outboundDistance,
      durationSec: Math.round((outboundDistance / 4000) * 3600),
      isRecommendedEdge: true,
    },
    {
      segmentId: 'return-start',
      order: 3,
      role: 'return',
      fromNodeId: entryNodeId,
      toNodeId: 'start',
      source: 'TMAP',
      path: returnToStartPath,
      distanceM: approach.distance,
      durationSec: approach.time,
      isRecommendedEdge: false,
    },
  ]

  const fullPath: [number, number][] = []
  let distance = 0
  let time = 0
  for (const segment of segments) {
    distance += segment.distanceM
    time += segment.durationSec ?? 0
    for (const point of segment.path) {
      const last = fullPath[fullPath.length - 1]
      if (!last || last[0] !== point[0] || last[1] !== point[1]) fullPath.push(point)
    }
  }

  const warnings: Array<{ code: string; message: string; severity: 'info' | 'warning' | 'error' }> = []
  if (distance < targetDistance * 0.75 || distance > targetDistance * 1.3) {
    warnings.push({
      code: 'distance_out_of_tolerance',
      message: `목표 거리와 차이가 큽니다. 목표 ${Math.round(targetDistance)}m, 추천 ${Math.round(distance)}m입니다.`,
      severity: 'warning',
    })
  }
  if (outboundDistance < targetMainDistance * 0.85) {
    warnings.push({
      code: 'edge_too_short',
      message: '선택된 하천 edge가 목표 거리보다 짧아 가능한 범위까지만 왕복합니다.',
      severity: 'info',
    })
  }

  return {
    routeType: 'simple_round_trip',
    routeTypeLabel: routeTypeLabel('simple_round_trip'),
    edgeIds: [edge.edgeId],
    nodeIds: [entryNodeId, endNodeId],
    path: fullPath,
    legs: segments.map((segment) => ({
      index: segment.order,
      fromNodeId: segment.fromNodeId,
      toNodeId: segment.toNodeId,
      mode: segment.role === 'return' ? 'return' as const : 'outbound' as const,
      path: segment.path,
      distance: segment.distanceM,
      time: segment.durationSec ?? 0,
    })),
    segments,
    turnNodeId: endNodeId,
    distance,
    time,
    warnings,
  }
}

async function connectEdgesWithTmapV2(
  appKey: string,
  cache: RouteCache,
  start: { lat: number; lng: number },
  edges: ApiEdge[],
  targetDistance: number,
  routePreference: RoutePreference,
) {
  const usableEdges = edges.filter((candidate) => Array.isArray(candidate.nodes) && candidate.nodes.length >= 2)
  if (!usableEdges.length) throw new Error('LLM이 유효한 edgeIds를 반환하지 않았습니다.')

  const segments: RouteSegment[] = []
  const usedEdgeIds: string[] = []
  const nodeIds: string[] = []
  let current = start
  let currentNodeId = 'start'
  let builtDistance = 0
  let order = 0
  const mainDistanceLimit = routePreference === 'round_trip' ? targetDistance * 0.68 : targetDistance * 1.05

  for (const edge of usableEdges) {
    if (builtDistance >= mainDistanceLimit && usedEdgeIds.length > 0) break

    const useReverse = approxMeters(current, edge.to) < approxMeters(current, edge.from)
    const entry = useReverse ? edge.to : edge.from
    const exit = useReverse ? edge.from : edge.to
    const entryNodeId = useReverse ? edge.toNodeId : edge.fromNodeId
    const exitNodeId = useReverse ? edge.fromNodeId : edge.toNodeId
    const mainPath = useReverse ? [...(edge.nodes ?? [])].reverse() : [...(edge.nodes ?? [])]
    const connector = await getTmapRoute(appKey, cache, current, entry)

    if (connector.distance > 8) {
      segments.push({
        segmentId: `${order === 0 ? 'approach' : 'connector'}-${order}`,
        order,
        role: order === 0 ? 'approach' : 'connector',
        fromNodeId: currentNodeId,
        toNodeId: entryNodeId,
        source: 'TMAP',
        path: connector.path,
        distanceM: connector.distance,
        durationSec: connector.time,
        isRecommendedEdge: false,
      })
      builtDistance += connector.distance
      order += 1
    }

    segments.push({
      segmentId: `main-${edge.edgeId}`,
      order,
      role: 'main_edge',
      fromNodeId: entryNodeId,
      toNodeId: exitNodeId,
      edgeId: edge.edgeId,
      source: 'OSM',
      path: mainPath,
      distanceM: edge.distanceM,
      durationSec: Math.round((edge.distanceM / 4000) * 3600),
      isRecommendedEdge: true,
    })
    builtDistance += edge.distanceM
    usedEdgeIds.push(edge.edgeId)
    nodeIds.push(entryNodeId, exitNodeId)
    current = exit
    currentNodeId = exitNodeId
    order += 1
  }

  let returning: TmapRoute | null = null
  if (routePreference === 'round_trip') {
    returning = await getTmapRoute(appKey, cache, current, start)
    segments.push({
      segmentId: `return-${order}`,
      order,
      role: 'return',
      fromNodeId: currentNodeId,
      toNodeId: 'start',
      source: 'TMAP',
      path: returning.path,
      distanceM: returning.distance,
      durationSec: returning.time,
      isRecommendedEdge: false,
    })
  }

  const fullPath: [number, number][] = []
  let distance = 0
  let time = 0
  for (const segment of segments) {
    distance += segment.distanceM
    time += segment.durationSec ?? 0
    for (const point of segment.path) {
      const last = fullPath[fullPath.length - 1]
      if (!last || last[0] !== point[0] || last[1] !== point[1]) fullPath.push(point)
    }
  }

  const warnings: Array<{ code: string; message: string; severity: 'info' | 'warning' | 'error' }> = []
  if (distance < targetDistance * 0.75 || distance > targetDistance * 1.3) {
    warnings.push({
      code: 'distance_out_of_tolerance',
      message: `목표 거리와 차이가 큽니다. 목표 ${Math.round(targetDistance)}m, 추천 ${Math.round(distance)}m입니다.`,
      severity: 'warning',
    })
  }
  if (usedEdgeIds.length < usableEdges.length) {
    warnings.push({
      code: 'edge_trimmed_by_distance',
      message: `목표 거리를 맞추기 위해 LLM이 선택한 ${usableEdges.length}개 edge 중 ${usedEdgeIds.length}개만 사용했습니다.`,
      severity: 'info',
    })
  }
  if (returning && returning.distance > Math.max(900, targetDistance * 0.7)) {
    warnings.push({
      code: 'tmap_detour_high',
      message: '복귀 구간이 길어 부분 순환형보다는 이동 목적 경로처럼 보일 수 있습니다.',
      severity: 'warning',
    })
  }

  const routeType = routePreference === 'one_way'
    ? 'one_way'
    : returning && returning.distance < targetDistance * 0.45 ? 'partial_loop' : 'simple_round_trip'
  const legs = segments.map((segment) => ({
    index: segment.order,
    fromNodeId: segment.fromNodeId,
    toNodeId: segment.toNodeId,
    mode: segment.role === 'return' ? 'return' as const : 'outbound' as const,
    path: segment.path,
    distance: segment.distanceM,
    time: segment.durationSec ?? 0,
  }))

  return {
    routeType,
    routeTypeLabel: routeTypeLabel(routeType),
    edgeIds: usedEdgeIds,
    nodeIds: [...new Set(nodeIds)],
    path: fullPath,
    legs,
    segments,
    turnNodeId: currentNodeId === 'start' ? null : currentNodeId,
    distance,
    time,
    warnings,
  }
}

function walkRecommendationApi(env: Record<string, string>): Plugin {
  return {
    name: 'walk-recommendation-api',
    configureServer(server) {
      server.middlewares.use('/api/recommend-walk', async (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'POST만 지원합니다.' })
          return
        }

        const apiKey = env.CNU_GATEWAY_API_KEY || env.OPENAI_API_KEY
        const gatewayBaseUrl = env.CNU_GATEWAY_BASE_URL || 'https://factchat-cloud.mindlogic.ai/v1/gateway'
        const tmapKey = env.TMAP_REST_APP_KEY || env.VITE_TMAP_APP_KEY
        if (!apiKey) {
          sendJson(res, 500, { error: '.env에 CNU_GATEWAY_API_KEY가 없습니다.' })
          return
        }
        if (!tmapKey) {
          sendJson(res, 500, { error: '.env에 VITE_TMAP_APP_KEY 또는 TMAP_REST_APP_KEY가 없습니다.' })
          return
        }

        try {
          const payload = await readJsonBody(req)
          const model = env.CNU_GATEWAY_MODEL || env.OPENAI_MODEL || 'gpt-5.4'
          const nodes = Array.isArray(payload.nodes) ? payload.nodes as unknown as ApiNode[] : []
          const edges = Array.isArray(payload.edges) ? payload.edges as unknown as ApiEdge[] : []
          const start = payload.start as { lat: number; lng: number }
          const theme = (payload.theme ?? {}) as WalkTheme
          const targetDistance = Number(payload.targetDistance)
          const routePreference: RoutePreference = payload.routePreference === 'one_way' ? 'one_way' : 'round_trip'
          if (!start || !Number.isFinite(start.lat) || !Number.isFinite(start.lng)) throw new Error('start 좌표가 필요합니다.')
          if (!Number.isFinite(targetDistance)) throw new Error('targetDistance가 필요합니다.')
          if (nodes.length < 2 && edges.length < 1) throw new Error('후보 node/edge가 부족합니다.')

          let input = `너는 대전 산책 경로 추천 엔진이다.
현재 위치와 후보 노드 목록을 보고 산책코스에 적합한 노드 ID 리스트를 선택한다.
이번 테스트의 유일한 조건은 목표 거리다. 너무 많은 노드를 고르지 말고 3~8개 사이로 선택한다.
사용자가 선택한 산책 키워드:
- 테마: ${theme.label ?? '거리 기준 산책'}
- 키워드: ${(theme.keywords ?? []).join(', ') || '없음'}
- 선호 태그: ${(theme.preferredTags ?? []).join(', ') || '없음'}
- 선택 기준: ${theme.prompt ?? '목표 거리와 현재 위치에 맞는 산책 노드를 고른다.'}
후보 노드를 고를 때 목표 거리뿐 아니라 위 테마와 키워드에 어울리는 노드를 우선한다.
각 후보 node의 tags와 description을 주요 판단 근거로 사용한다.
선호 태그와 많이 겹치는 tags를 가진 노드를 우선 선택한다.
노드 순서는 서버가 TMAP 실제 보행거리 기준으로 다시 정렬하므로, 너는 방문하면 좋을 후보 노드만 고른다.
현재 위치 주변에서 목표 거리 ${targetDistance}m에 가까운 산책 코스가 될 만한 노드를 고른다.
반환한 nodeIds는 반드시 후보 nodes 안에 존재하는 nodeId만 사용한다.
반드시 JSON만 반환한다. 형식:
{"nodeIds":["...","..."],"title":"...","reason":"...","steps":["...","...","..."]}

입력:
${JSON.stringify({ start, targetDistance, theme, nodes })}`

          input = `너는 산책 경로 엔진이 아니다.
후보 edge 중 사용자의 테마와 잘 맞는 산책 구간을 고른다.
좌표, 거리, 경로 geometry를 만들지 않는다. 반드시 입력 candidateEdges 안의 edgeId만 반환한다.
서버가 실제 접근/복귀 가능성과 routeType을 검증하므로, 너는 산책 품질과 테마 적합도를 판단한다.

사용자 조건:
- 테마: ${theme.label ?? '거리 기준 산책'}
- 키워드: ${(theme.keywords ?? []).join(', ') || '없음'}
- 선호 태그: ${(theme.preferredTags ?? []).join(', ') || '없음'}
- 목표 거리: ${targetDistance}m
- 선택 기준: ${theme.prompt ?? '목표 거리와 현재 위치에 맞는 산책 edge를 고른다.'}

좋은 edge 판단 기준:
- preferredTags와 tags가 잘 맞는다.
- 너무 짧거나 현재 위치에서 너무 먼 edge는 피한다.
- 하천/공원/보행자 전용/평탄한 길을 우선한다.
- 자전거 겸용은 가능하지만 보행 친화 점수는 낮게 본다.
- 자연스럽게 출발지로 돌아오기 쉬운 edge를 우대한다.

JSON만 반환:
{"edgeIds":["..."],"preferredRouteTypes":["partial_loop","simple_round_trip"],"title":"...","reason":"...","steps":["...","..."],"warnings":[]}
fallback이 필요할 때만 기존 nodeIds도 함께 반환할 수 있다.

입력:
${JSON.stringify({ start, targetDistance, theme, candidateEdges: edges, fallbackNodes: nodes.slice(0, 40) })}`

          input += `

추가 필수 조건:
- routePreference: ${routePreference}
- ${routePreference === 'one_way' ? '편도 코스이므로 출발지로 돌아오는 edge를 고르지 않아도 된다. 종료점이 너무 멀어지지 않는 edge를 우선한다.' : '왕복 코스이므로 출발지 근처로 돌아오기 쉬운 edge를 우선한다.'}`
          if ((theme.preferredTags ?? []).some((tag) => tag === 'river' || tag === 'gapcheon')) {
            input += `
- 하천 테마에서는 river-corridor 태그가 있는 긴 edge를 최우선한다.
- 하천 둔치 산책로는 cycleway/shared-bike로 태깅될 수 있으므로, footway만 고집하지 않는다.
- 짧은 connector나 아파트 단지 옆 footway는 하천 산책 본선으로 고르지 않는다.`
          }
          input += `
입력 routePreference 포함:
${JSON.stringify({ routePreference })}`

          const upstream = await fetch(`${gatewayBaseUrl.replace(/\/$/, '')}/responses`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model,
              input,
              temperature: 0.2,
            }),
          })

          const text = await upstream.text()
          if (!upstream.ok) {
            sendJson(res, upstream.status, { error: `OpenAI API 오류: ${text.slice(0, 500)}` })
            return
          }

          const data = JSON.parse(text)
          const outputText =
            data.output_text ??
            data.output?.flatMap((item: { content?: Array<{ text?: string }> }) => item.content ?? [])
              .map((content: { text?: string }) => content.text ?? '')
              .join('')
          const parsed = parseJsonFromModel(String(outputText))
          const edgeIds: string[] = Array.isArray(parsed.edgeIds) ? parsed.edgeIds.map((id: unknown) => String(id)) : []
          const selectedEdges = edgeIds
            .map((id) => edges.find((edge) => edge.edgeId === id))
            .filter(Boolean) as ApiEdge[]
          if (selectedEdges.length >= 1) {
            const routeCache: RouteCache = new Map()
            const wantsRiver = (theme.preferredTags ?? []).some((tag) => tag === 'river' || tag === 'gapcheon' || tag === 'open-view')
            const edgeRoute = routePreference === 'round_trip' && wantsRiver
              ? await connectRiverOutAndBack(tmapKey, routeCache, start, edges, targetDistance)
              : await connectEdgesWithTmapV2(tmapKey, routeCache, start, selectedEdges, targetDistance, routePreference)
            sendJson(res, 200, {
              ...edgeRoute,
              originalEdgeIds: selectedEdges.map((edge) => edge.edgeId),
              title: parsed.title ?? 'edge 기반 산책 경로',
              reason: parsed.reason ?? '',
              steps: Array.isArray(parsed.steps) ? parsed.steps : [],
            })
            return
          }

          const nodeIds: string[] = Array.isArray(parsed.nodeIds) ? parsed.nodeIds.map((id: unknown) => String(id)) : []
          const selectedNodes = nodeIds
            .map((id) => nodes.find((node) => node.nodeId === id))
            .filter(Boolean) as ApiNode[]
          if (selectedNodes.length < 1) throw new Error('LLM이 유효한 nodeIds를 반환하지 않았습니다.')

          const routeCache: RouteCache = new Map()
          const orderedNodes = await reorderNodesForWalk(tmapKey, routeCache, start, selectedNodes, targetDistance)
          const tmapRoute = await connectNodesWithTmap(tmapKey, routeCache, start, orderedNodes)
          sendJson(res, 200, {
            nodeIds: orderedNodes.map((node) => node.nodeId),
            originalNodeIds: selectedNodes.map((node) => node.nodeId),
            title: parsed.title ?? 'LLM 선택 산책 경로',
            reason: parsed.reason ?? '',
            steps: Array.isArray(parsed.steps) ? parsed.steps : [],
            ...tmapRoute,
          })
        } catch (error) {
          sendJson(res, 500, { error: error instanceof Error ? error.message : '추천 API 처리 실패' })
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), walkRecommendationApi(env)],
  }
})
