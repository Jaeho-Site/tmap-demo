import { OSM_GAPCHEON_WALKS } from './osmGapcheonWalks'

export type OsmRouteTypeHint =
  | 'river_walk'
  | 'park_walk'
  | 'connector'
  | 'cycle_shared'
  | 'steps'
  | 'service_access'
  | 'unknown_walkable'

export interface OsmWalkGraphNode {
  id: string
  lat: number
  lng: number
}

export interface OsmWalkEdge {
  id: string
  osmWayId: number
  from: string
  to: string
  length: number
  bidirectional: boolean
  nodes: Array<{
    id?: string
    lat: number
    lng: number
  }>
  tags: {
    name?: string
    highway?: string
    surface?: string
    foot?: string
    bicycle?: string
    access?: string
  }
  source: {
    provider: 'OSM'
    fetchedAt: string
    query: 'mvp-gapcheon-walk-edges'
  }
  routeTypeHints: OsmRouteTypeHint[]
  costHints: {
    walkableScore: number
    comfortScore: number
    jointPenalty: number
    bikeConflictPenalty: number
  }
}

const FETCHED_AT = '2026-07-08'

function nodeId(lat: number, lng: number) {
  return `n${lat.toFixed(6)}_${lng.toFixed(6)}`
}

function routeTypeHints(walk: typeof OSM_GAPCHEON_WALKS[number], length: number): OsmRouteTypeHint[] {
  const hints: OsmRouteTypeHint[] = ['river_walk']
  if (length < 80) hints.push('connector')
  if (walk.highway === 'cycleway' || walk.bicycle === 'designated' || walk.bicycle === 'yes') {
    hints.push('cycle_shared')
  }
  if (walk.highway === 'steps') hints.push('steps')
  if (walk.highway === 'service' || walk.highway === 'track') hints.push('service_access')
  if (hints.length === 0) hints.push('unknown_walkable')
  return hints
}

function walkableScore(walk: typeof OSM_GAPCHEON_WALKS[number]) {
  if (walk.foot === 'no') return 0.1
  if (walk.highway === 'footway' || walk.highway === 'pedestrian') return 0.95
  if (walk.highway === 'path') return 0.88
  if (walk.highway === 'cycleway' && (walk.foot === 'yes' || walk.foot === 'designated')) return 0.72
  return 0.6
}

function comfortScore(walk: typeof OSM_GAPCHEON_WALKS[number]) {
  let score = 0.55
  if (walk.surface === 'paved' || walk.surface === 'asphalt' || walk.surface === 'concrete') score += 0.2
  if (walk.highway === 'footway' || walk.highway === 'pedestrian' || walk.highway === 'path') score += 0.15
  if (walk.highway === 'cycleway') score -= 0.08
  return Math.max(0, Math.min(1, score))
}

export const OSM_WALK_EDGES: OsmWalkEdge[] = OSM_GAPCHEON_WALKS
  .filter((walk) => walk.length >= 30 && walk.nodes.length >= 2)
  .map((walk) => {
    const fromNode = walk.nodes[0]
    const toNode = walk.nodes[walk.nodes.length - 1]
    const from = nodeId(fromNode.lat, fromNode.lng)
    const to = nodeId(toNode.lat, toNode.lng)
    return {
      id: `osm-edge-${walk.osmId}`,
      osmWayId: walk.osmId,
      from,
      to,
      length: walk.length,
      bidirectional: true,
      nodes: walk.nodes.map((node) => ({
        id: nodeId(node.lat, node.lng),
        lat: node.lat,
        lng: node.lng,
      })),
      tags: {
        name: walk.name,
        highway: walk.highway,
        surface: walk.surface || undefined,
        foot: walk.foot || undefined,
        bicycle: walk.bicycle || undefined,
      },
      source: {
        provider: 'OSM',
        fetchedAt: FETCHED_AT,
        query: 'mvp-gapcheon-walk-edges',
      },
      routeTypeHints: routeTypeHints(walk, walk.length),
      costHints: {
        walkableScore: walkableScore(walk),
        comfortScore: comfortScore(walk),
        jointPenalty: walk.highway === 'steps' ? 0.8 : 0,
        bikeConflictPenalty: walk.highway === 'cycleway' || walk.bicycle === 'designated' ? 0.25 : 0,
      },
    } satisfies OsmWalkEdge
  })

const nodeMap = new Map<string, OsmWalkGraphNode>()
for (const edge of OSM_WALK_EDGES) {
  for (const node of edge.nodes) {
    if (!node.id || nodeMap.has(node.id)) continue
    nodeMap.set(node.id, { id: node.id, lat: node.lat, lng: node.lng })
  }
}

export const OSM_WALK_GRAPH_NODES: OsmWalkGraphNode[] = [...nodeMap.values()]
