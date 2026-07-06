import { STREETS } from './streets'

// 가로수 종류 키워드 → 연결선 색상 (앞쪽 우선순위로 매칭)
const TREE_COLOR_RULES: { key: string; color: string; label: string }[] = [
  { key: '벚', color: '#ec4899', label: '벚나무' },
  { key: '이팝', color: '#84cc16', label: '이팝나무' },
  { key: '배롱', color: '#db2777', label: '배롱나무' },
  { key: '단풍', color: '#ef4444', label: '단풍' },
  { key: '은행', color: '#eab308', label: '은행나무' },
  { key: '느티', color: '#15803d', label: '느티나무' },
  { key: '메타세', color: '#0d9488', label: '메타세쿼이아' },
]
const DEFAULT_TREE = { color: '#10b981', label: '기타 수종' }

export function treeColor(treeType: string): string {
  const hit = TREE_COLOR_RULES.find((r) => treeType.includes(r.key))
  return hit ? hit.color : DEFAULT_TREE.color
}

// 범례용 (해당 수종이 실제로 존재하는 것만)
export const STREET_TREE_LEGEND = [...TREE_COLOR_RULES, DEFAULT_TREE].filter((rule) =>
  'key' in rule
    ? STREETS.some((s) => s.treeType.includes((rule as { key: string }).key))
    : true,
)

export const STREET_TOTAL = STREETS.length

// 총 연장(km) 합계 — 참고 지표
export const STREET_TOTAL_LENGTH = Number(
  STREETS.reduce((sum, s) => sum + (s.length ?? 0), 0).toFixed(1),
)
