import { WALKWAYS } from './walkways'

export const WALKWAY_TOTAL = WALKWAYS.length
export const WALKWAY_POINT_COUNT = WALKWAYS.filter((w) => w.isPoint).length
export const WALKWAY_LINE_COUNT = WALKWAY_TOTAL - WALKWAY_POINT_COUNT
export const WALKWAY_SEPARATED_COUNT = WALKWAYS.filter((w) => w.separated).length

// 색상 범례 (보차분리 여부)
export const WALKWAY_LEGEND = [
  { label: '보차분리 O', color: '#2563eb' },
  { label: '보차분리 X', color: '#64748b' },
]
