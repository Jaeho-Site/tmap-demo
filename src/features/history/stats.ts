import type { WalkRecord } from '@/types/walk'

export interface WalkStats {
  totalWalks: number
  totalDistanceM: number
  monthWalks: number
  monthDistanceM: number
  /** 연속 산책 일수(오늘 또는 어제 기준). */
  dayStreak: number
}

const dayStr = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

export function computeStats(records: WalkRecord[]): WalkStats {
  const now = new Date()
  const curMonth = now.getFullYear() * 12 + now.getMonth()

  let totalDistanceM = 0
  let monthWalks = 0
  let monthDistanceM = 0
  const days = new Set<string>()

  for (const r of records) {
    const d = new Date(r.endedAt)
    totalDistanceM += r.distanceM
    if (d.getFullYear() * 12 + d.getMonth() === curMonth) {
      monthWalks++
      monthDistanceM += r.distanceM
    }
    days.add(dayStr(d))
  }

  // 연속 일수 — 오늘부터(없으면 어제부터) 하루씩 거슬러 카운트
  let dayStreak = 0
  const cur = new Date(now)
  if (!days.has(dayStr(cur))) cur.setDate(cur.getDate() - 1)
  while (days.has(dayStr(cur))) {
    dayStreak++
    cur.setDate(cur.getDate() - 1)
  }

  return {
    totalWalks: records.length,
    totalDistanceM,
    monthWalks,
    monthDistanceM,
    dayStreak,
  }
}
