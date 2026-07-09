export interface TagDef {
  id: string
  label: string
  emoji: string
}

// 👎 문제 태그 — 검증 데이터 대부분을 담당(마찰 사다리 2단계, UX P4)
export const PROBLEM_TAGS: TagDef[] = [
  { id: 'construction', label: '공사중', emoji: '🚧' },
  { id: 'noisy', label: '시끄러움', emoji: '🔇' },
  { id: 'nopath', label: '길없음', emoji: '🚫' },
  { id: 'dark', label: '어두움', emoji: '🌑' },
  { id: 'danger', label: '위험', emoji: '⚠️' },
]

// 👍 긍정 태그 — 좋은 코스 신호 강화
export const POSITIVE_TAGS: TagDef[] = [
  { id: 'scenic', label: '경치 좋음', emoji: '🌳' },
  { id: 'safe', label: '안전함', emoji: '🛡️' },
  { id: 'quiet', label: '조용함', emoji: '🤫' },
  { id: 'rest', label: '쉼터 많음', emoji: '🪑' },
  { id: 'comfy', label: '걷기 편함', emoji: '😀' },
]

export const isProblemLabel = (label: string): boolean =>
  PROBLEM_TAGS.some((t) => t.label === label)
