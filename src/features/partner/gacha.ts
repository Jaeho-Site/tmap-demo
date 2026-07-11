// 산책 파트너 가챠 엔진 (F2). 순수 함수 — 테스트/재현 용이(rnd 주입 가능).

export type Rarity = 'D' | 'C' | 'B' | 'A' | 'S' // 낮음 → 높음
export type BoxKind = 'normal' | 'guaranteed'

export const RARITY_ORDER: Rarity[] = ['D', 'C', 'B', 'A', 'S']

export interface RarityMeta {
  label: string
  color: string // 희귀도 색(플레이스홀더 타일/뱃지)
}
export const RARITY_META: Record<Rarity, RarityMeta> = {
  D: { label: '일반', color: '#9aa0a6' },
  C: { label: '고급', color: '#34d399' },
  B: { label: '희귀', color: '#38bdf8' },
  A: { label: '영웅', color: '#a78bfa' },
  S: { label: '전설', color: '#fbbf24' },
}

/** 일반 상자 확률(%) — 합 100. */
export const NORMAL_ODDS: Record<Rarity, number> = { D: 45, C: 30, B: 17, A: 6, S: 2 }
/** 확정 상자 확률(%) — 최소 A 이상 보장. */
export const GUARANTEED_ODDS: Record<Rarity, number> = { D: 0, C: 0, B: 0, A: 80, S: 20 }

/** 천장: 일반 상자를 이 횟수까지 S 없이 열면 다음 뽑기 S 확정. */
export const PITY_LIMIT = 50

function rollFrom(odds: Record<Rarity, number>, rnd: () => number): Rarity {
  const total = RARITY_ORDER.reduce((s, k) => s + odds[k], 0)
  let r = rnd() * total
  for (const k of RARITY_ORDER) {
    r -= odds[k]
    if (r <= 0) return k
  }
  return 'D'
}

export interface DrawOutcome {
  rarity: Rarity
  nextPity: number
  byPity: boolean // 천장으로 S가 확정된 경우
}

/**
 * 상자 1개 뽑기. pity는 "S 없이 연속으로 연 일반 상자 수".
 * 일반 상자에서 pity가 한계에 도달하면 S 확정, 확정 상자는 pity에 영향 없음.
 */
export function drawRarity(kind: BoxKind, pity: number, rnd: () => number = Math.random): DrawOutcome {
  if (kind === 'normal' && pity + 1 >= PITY_LIMIT) {
    return { rarity: 'S', nextPity: 0, byPity: true }
  }
  const rarity = rollFrom(kind === 'guaranteed' ? GUARANTEED_ODDS : NORMAL_ODDS, rnd)
  // 확정 상자는 천장 카운터를 건드리지 않는다(일반 상자만 누적/리셋).
  const nextPity = kind === 'guaranteed' ? pity : rarity === 'S' ? 0 : pity + 1
  return { rarity, nextPity, byPity: false }
}
