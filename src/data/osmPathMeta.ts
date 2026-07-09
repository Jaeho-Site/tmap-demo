import { OSM_PATHS, type OsmPathCategory } from './osmPaths'

export const OSM_PATH_COLORS: Record<OsmPathCategory, string> = {
  park_walk: '#22c55e',
  river_walk: '#0ea5e9',
}

export const OSM_PATH_LABELS: Record<OsmPathCategory, string> = {
  park_walk: '공원 내부 산책로',
  river_walk: '하천로',
}

const VISIBLE_OSM_PATHS = OSM_PATHS.filter((path) => path.category === 'park_walk')

export const OSM_PATH_TOTAL = VISIBLE_OSM_PATHS.length
export const OSM_PATH_NODE_TOTAL = VISIBLE_OSM_PATHS.reduce((sum, path) => sum + path.nodes.length, 0)
export const OSM_PATH_TOTAL_LENGTH_KM = Math.round(
  VISIBLE_OSM_PATHS.reduce((sum, path) => sum + path.length, 0) / 1000,
)

export const OSM_PATH_COUNTS = [
  {
    category: 'park_walk' as const,
    label: OSM_PATH_LABELS.park_walk,
    color: OSM_PATH_COLORS.park_walk,
    count: OSM_PATHS.filter((path) => path.category === 'park_walk').length,
  },
]
