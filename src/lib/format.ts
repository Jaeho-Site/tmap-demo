/** 초 → "M:SS" (또는 시간 포함 "H:MM:SS"). */
export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

/** 미터 → 사람이 읽는 문자열. */
export function formatMetersKm(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`
}

/** 걸은 거리(m) 기준 대략 소모 칼로리(체중 60kg, 보행 ~0.5 kcal/kg/km 근사). */
export function estimateKcal(distanceM: number): number {
  return Math.round((distanceM / 1000) * 0.5 * 60)
}

/** 산책 날짜 — 오늘/어제 또는 "M월 D일". */
export function formatWalkDate(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000)
  if (diffDays === 0) return '오늘'
  if (diffDays === 1) return '어제'
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}
