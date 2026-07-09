import { OSM_WALK_EDGES, OSM_WALK_GRAPH_NODES, type OsmRouteTypeHint } from './osmWalkEdges'

export const OSM_WALK_EDGE_COLOR = '#7c3aed'

export const OSM_WALK_EDGE_TOTAL = OSM_WALK_EDGES.length
export const OSM_WALK_EDGE_NODE_TOTAL = OSM_WALK_GRAPH_NODES.length
export const OSM_WALK_EDGE_TOTAL_LENGTH_KM = Math.round(
  OSM_WALK_EDGES.reduce((sum, edge) => sum + edge.length, 0) / 100,
) / 10

export const OSM_WALK_EDGE_HINT_LABELS: Record<OsmRouteTypeHint, string> = {
  river_walk: 'river walk',
  park_walk: 'park walk',
  connector: 'connector',
  cycle_shared: 'cycle shared',
  steps: 'steps',
  service_access: 'service access',
  unknown_walkable: 'unknown walkable',
}

export const OSM_WALK_EDGE_HINT_COUNTS = Object.entries(
  OSM_WALK_EDGES.reduce<Record<string, number>>((counts, edge) => {
    for (const hint of edge.routeTypeHints) counts[hint] = (counts[hint] ?? 0) + 1
    return counts
  }, {}),
).map(([hint, count]) => ({ hint: hint as OsmRouteTypeHint, count }))
