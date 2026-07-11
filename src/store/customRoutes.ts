import { create } from 'zustand'
import type { LatLng } from '@/types/course'
import type { TripType } from '@/features/adventure/suggestRoute'

/** 공유 검토 상태 — 미공유·검토중·승인·반려. */
export type ShareStatus = 'private' | 'pending' | 'approved' | 'rejected'

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
  // 공유/검토 (F3) — 기본 'private'
  shareStatus: ShareStatus
  sharedAt?: number
  // 인기 랭킹 (F4)
  usageCount?: number
  authorName?: string
}

const KEY = 'sanchaek.customRoutes'
const AUTH_KEY = 'sanchaek.auth'

/**
 * 목업 검토 큐: 공유 후 이 시간이 지나면 자동 승인한다.
 * 실서비스에서는 관리자 검토 콘솔/큐(백엔드)로 대체하고 이 상수는 제거한다.
 */
export const REVIEW_MS = 8000

const PROVIDER_LABEL: Record<string, string> = {
  kakao: '카카오',
  naver: '네이버',
  google: 'Google',
  guest: '게스트',
}

/** 프로토타입: 로그인 provider를 작성자명으로 사용. */
function currentAuthorName(): string {
  try {
    const p = localStorage.getItem(AUTH_KEY) ?? 'guest'
    return `${PROVIDER_LABEL[p] ?? '게스트'} 워커`
  } catch {
    return '게스트 워커'
  }
}

/** 저장 스키마 마이그레이션 — 구버전 항목에 shareStatus 기본값 부여. */
function normalize(r: CustomRoute): CustomRoute {
  return { ...r, shareStatus: r.shareStatus ?? 'private' }
}

function load(): CustomRoute[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as CustomRoute[]
    return raw.map(normalize)
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

/**
 * 실서비스 검토 API 자리(인터페이스만 고정). 프로토타입은 시간 경과 자동 승인으로 목업한다.
 * 서버 연동 시 이 시그니처를 유지한 채 body만 REST 호출로 교체.
 */
export interface ReviewApi {
  reviewRoute(id: string): Promise<ShareStatus>
}

interface CustomRoutesState {
  routes: CustomRoute[]
  /** id가 같으면 갱신, 없으면 최신순 맨 앞에 추가. */
  save: (route: CustomRoute) => void
  remove: (id: string) => void
  /** 공유 신청 → 검토중. sharedAt 기록 후 REVIEW_MS 뒤 자동 승인 예약. */
  share: (id: string) => void
  /** 공유 취소 → 미공유. */
  unshare: (id: string) => void
  /** 사용 횟수 +1 (공유·승인된 경로를 다시 걸을 때). */
  bumpUsage: (id: string) => void
  /** 검토중이고 REVIEW_MS 경과한 경로를 승인으로 전환(목업 검토 큐). */
  settleReviews: () => void
}

export const useCustomRoutes = create<CustomRoutesState>((set, get) => ({
  routes: load().sort((a, b) => b.createdAt - a.createdAt),
  save: (route) =>
    set((s) => {
      const routes = [normalize(route), ...s.routes.filter((r) => r.id !== route.id)]
      persist(routes)
      return { routes }
    }),
  remove: (id) =>
    set((s) => {
      const routes = s.routes.filter((r) => r.id !== id)
      persist(routes)
      return { routes }
    }),
  share: (id) => {
    set((s) => {
      const routes = s.routes.map((r) =>
        r.id === id
          ? {
              ...r,
              shareStatus: 'pending' as ShareStatus,
              sharedAt: Date.now(),
              authorName: r.authorName ?? currentAuthorName(),
              usageCount: r.usageCount ?? 0,
            }
          : r,
      )
      persist(routes)
      return { routes }
    })
    setTimeout(() => get().settleReviews(), REVIEW_MS)
  },
  unshare: (id) =>
    set((s) => {
      const routes = s.routes.map((r) =>
        r.id === id ? { ...r, shareStatus: 'private' as ShareStatus, sharedAt: undefined } : r,
      )
      persist(routes)
      return { routes }
    }),
  bumpUsage: (id) =>
    set((s) => {
      const routes = s.routes.map((r) =>
        r.id === id ? { ...r, usageCount: (r.usageCount ?? 0) + 1 } : r,
      )
      persist(routes)
      return { routes }
    }),
  settleReviews: () =>
    set((s) => {
      const now = Date.now()
      let changed = false
      const routes = s.routes.map((r) => {
        if (r.shareStatus === 'pending' && now - (r.sharedAt ?? now) >= REVIEW_MS) {
          changed = true
          return { ...r, shareStatus: 'approved' as ShareStatus }
        }
        return r
      })
      if (!changed) return s
      persist(routes)
      return { routes }
    }),
}))

// 이전 세션에서 공유·검토중이던 경로를 앱 시작 시 정산(경과분 즉시 승인)
useCustomRoutes.getState().settleReviews()

/** 스토어 밖(라우트 로더 등)에서의 단발 조회. */
export function getCustomRoute(id: string): CustomRoute | undefined {
  return load().find((r) => r.id === id)
}
