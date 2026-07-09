import type { LatLng } from '@/types/course'

const R = 6371000 // 지구 반지름(m)
const rad = (d: number) => (d * Math.PI) / 180

/** 두 좌표 사이 거리(m) — Haversine. */
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

/** 경로의 중간 지점 좌표. */
export function midpoint(path: LatLng[]): LatLng {
  return path[Math.floor(path.length / 2)] ?? path[0]
}

/** km → 사람이 읽는 거리 문자열. */
export function formatDistance(km: number): string {
  return km >= 1 ? `${km} km` : `${Math.round(km * 1000)} m`
}
