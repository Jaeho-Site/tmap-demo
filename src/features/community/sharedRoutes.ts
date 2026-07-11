import { useMemo } from 'react'
import type { LatLng } from '@/types/course'
import { DAEJEON_CENTER } from '@/config'
import { useCustomRoutes, getCustomRoute, type CustomRoute } from '@/store/customRoutes'

/**
 * 공유·승인된 산책로의 인기 랭킹(F4).
 * 프로토타입: 시드 목업 + 내 승인 경로 병합, 사용수 내림차순.
 * 실서비스에서는 다중 사용자 사용수 집계(서버)로 SEED_SHARED를 대체한다.
 */
export interface SharedRoute {
  id: string
  name: string
  kind: 'ai' | 'free'
  distanceKm: number
  estMinutes: number
  path: LatLng[]
  usageCount: number
  authorName: string
}

const estMin = (km: number) => Math.round(km * 15)

/** 중심점 근처 간단한 루프 경로(시드 지도 표시용). */
function loop(center: LatLng, rKm: number, n = 10): LatLng[] {
  const dLat = rKm / 111
  const dLng = rKm / (111 * Math.cos((center.lat * Math.PI) / 180))
  const pts: LatLng[] = []
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2
    pts.push({ lat: center.lat + Math.sin(a) * dLat, lng: center.lng + Math.cos(a) * dLng })
  }
  return pts
}

const C = DAEJEON_CENTER
export const SEED_SHARED: SharedRoute[] = [
  {
    id: 'seed-gapcheon',
    name: '갑천 노을 산책로',
    kind: 'free',
    distanceKm: 3.2,
    estMinutes: estMin(3.2),
    path: loop({ lat: C.lat + 0.012, lng: C.lng - 0.014 }, 0.5),
    usageCount: 214,
    authorName: '네이버 워커',
  },
  {
    id: 'seed-hanbat',
    name: '한밭수목원 한 바퀴',
    kind: 'free',
    distanceKm: 2.4,
    estMinutes: estMin(2.4),
    path: loop({ lat: C.lat + 0.006, lng: C.lng + 0.004 }, 0.38),
    usageCount: 176,
    authorName: '카카오 워커',
  },
  {
    id: 'seed-expo',
    name: '엑스포 다리 야경 코스',
    kind: 'ai',
    distanceKm: 4.1,
    estMinutes: estMin(4.1),
    path: loop({ lat: C.lat + 0.018, lng: C.lng + 0.01 }, 0.62),
    usageCount: 143,
    authorName: 'Google 워커',
  },
  {
    id: 'seed-yuseong',
    name: '유성 온천천 아침길',
    kind: 'free',
    distanceKm: 1.8,
    estMinutes: estMin(1.8),
    path: loop({ lat: C.lat - 0.008, lng: C.lng - 0.02 }, 0.3),
    usageCount: 97,
    authorName: '네이버 워커',
  },
  {
    id: 'seed-boramae',
    name: '보라매공원 멍때리기 루트',
    kind: 'ai',
    distanceKm: 1.2,
    estMinutes: estMin(1.2),
    path: loop({ lat: C.lat - 0.004, lng: C.lng + 0.012 }, 0.22),
    usageCount: 61,
    authorName: '카카오 워커',
  },
]

function customToShared(r: CustomRoute): SharedRoute {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind,
    distanceKm: r.distanceKm,
    estMinutes: r.estMinutes,
    path: r.path,
    usageCount: r.usageCount ?? 0,
    authorName: r.authorName ?? '나',
  }
}

/** 시드 + 내 승인 경로를 사용수 내림차순으로 병합한 랭킹. */
export function useRanking(limit = 10): SharedRoute[] {
  const routes = useCustomRoutes((s) => s.routes)
  return useMemo(() => {
    const mine = routes.filter((r) => r.shareStatus === 'approved').map(customToShared)
    return [...SEED_SHARED, ...mine].sort((a, b) => b.usageCount - a.usageCount).slice(0, limit)
  }, [routes, limit])
}

/** ?route= 지도 뷰용 통합 조회 — 내 저장 경로 우선, 없으면 시드. */
export function getSharedById(id: string): SharedRoute | undefined {
  const mine = getCustomRoute(id)
  if (mine) return customToShared(mine)
  return SEED_SHARED.find((s) => s.id === id)
}
