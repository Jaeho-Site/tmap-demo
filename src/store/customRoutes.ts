import { create } from 'zustand'
import type { LatLng } from '@/types/course'
import type { TripType } from '@/features/adventure/suggestRoute'

/**
 * 사용자가 저장한 커스텀 경로(자유 산책 트랙 · AI 추천 경로).
 * 카탈로그 코스가 아니므로 ID가 아닌 경로 데이터 전체를 보관한다.
 */
export interface CustomRoute {
  id: string
  name: string
  kind: 'ai' | 'free'
  distanceKm: number
  estMinutes: number
  path: LatLng[]
  trip?: TripType
  createdAt: number
}

const KEY = 'sanchaek.customRoutes'

function load(): CustomRoute[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as CustomRoute[]
  } catch {
    return []
  }
}
function persist(routes: CustomRoute[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(routes.slice(0, 100)))
  } catch {
    /* 저장 실패 무시 */
  }
}

interface CustomRoutesState {
  routes: CustomRoute[]
  /** id가 같으면 갱신, 없으면 최신순 맨 앞에 추가. */
  save: (route: CustomRoute) => void
  remove: (id: string) => void
}

export const useCustomRoutes = create<CustomRoutesState>((set) => ({
  routes: load().sort((a, b) => b.createdAt - a.createdAt),
  save: (route) =>
    set((s) => {
      const routes = [route, ...s.routes.filter((r) => r.id !== route.id)]
      persist(routes)
      return { routes }
    }),
  remove: (id) =>
    set((s) => {
      const routes = s.routes.filter((r) => r.id !== id)
      persist(routes)
      return { routes }
    }),
}))

/** 스토어 밖(라우트 로더 등)에서의 단발 조회. */
export function getCustomRoute(id: string): CustomRoute | undefined {
  return load().find((r) => r.id === id)
}
