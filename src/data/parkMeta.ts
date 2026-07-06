import { PARKS } from './parks'

// 공원구분별 색상 (지도 노드 + 사이드바 칩 공용)
export const PARK_CATEGORY_COLOR: Record<string, string> = {
  어린이공원: '#f59e0b',
  근린공원: '#16a34a',
  소공원: '#10b981',
  문화공원: '#8b5cf6',
  체육공원: '#ef4444',
  수변공원: '#0ea5e9',
  역사공원: '#a16207',
  기타: '#6b7280',
}

export const DEFAULT_PARK_COLOR = '#64748b'

export function parkColor(category: string): string {
  return PARK_CATEGORY_COLOR[category] ?? DEFAULT_PARK_COLOR
}

// 구분별 개수 (많은 순)
export const PARK_CATEGORY_COUNTS: { category: string; count: number }[] = Object.entries(
  PARKS.reduce<Record<string, number>>((acc, p) => {
    acc[p.category] = (acc[p.category] ?? 0) + 1
    return acc
  }, {}),
).map(([category, count]) => ({ category, count }))
  .sort((a, b) => b.count - a.count)

export const PARK_TOTAL = PARKS.length
