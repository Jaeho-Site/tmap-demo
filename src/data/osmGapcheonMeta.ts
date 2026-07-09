import { OSM_GAPCHEON_WALKS } from './osmGapcheonWalks'

export const OSM_GAPCHEON_COLOR = '#a855f7'
export const OSM_GAPCHEON_TOTAL = OSM_GAPCHEON_WALKS.length
export const OSM_GAPCHEON_NODE_TOTAL = OSM_GAPCHEON_WALKS.reduce(
  (sum, walk) => sum + walk.nodes.length,
  0,
)
export const OSM_GAPCHEON_TOTAL_LENGTH_KM = Math.round(
  OSM_GAPCHEON_WALKS.reduce((sum, walk) => sum + walk.length, 0) / 1000,
)
