import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, Sparkles, Footprints, Route, Share2, Clock, Check, Users } from 'lucide-react'
import { useSaved } from '@/store/saved'
import { useCustomRoutes, type CustomRoute } from '@/store/customRoutes'
import { getCourseMap } from '@/features/recommend/courses'
import { DifficultyBadge } from '@/components/ui/Badge'
import { formatDistance } from '@/lib/geo'

const THUMBS = ['/images/r1.jpg', '/images/r2.webp', '/images/r3.jpg', '/images/r5.jpg', '/images/r6.jpg']
const thumbFor = (id: string) =>
  THUMBS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % THUMBS.length]

export function SavedPage() {
  const navigate = useNavigate()
  const ids = useSaved((s) => s.ids)
  const courseMap = useMemo(() => getCourseMap(), [])
  const saved = useMemo(
    () => ids.map((id) => courseMap.get(id)).filter((c): c is NonNullable<typeof c> => !!c),
    [ids, courseMap],
  )
  const customRoutes = useCustomRoutes((s) => s.routes)
  const removeRoute = useCustomRoutes((s) => s.remove)
  const settleReviews = useCustomRoutes((s) => s.settleReviews)

  // 페이지 재진입 시 이전에 공유해 검토중이던 경로의 경과분을 즉시 승인 반영
  useEffect(() => {
    settleReviews()
  }, [settleReviews])

  const empty = saved.length === 0 && customRoutes.length === 0

  return (
    <div className="pb-8">
      <header className="px-4 pt-5 pb-3">
        <h1 className="text-2xl font-extrabold">저장</h1>
      </header>

      {empty ? (
        <div className="flex flex-col items-center gap-4 px-8 pt-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface">
            <Heart size={28} className="text-fg-muted" />
          </div>
          <h2 className="text-xl font-extrabold">저장한 코스가 없어요</h2>
          <p className="text-[15px] leading-relaxed text-fg-muted">
            코스 상세에서 하트를 누르거나,
            <br />
            모험에서 만든 경로를 저장해 다시 걸어요.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 저장한 코스 (카탈로그) */}
          {saved.length > 0 && (
            <section className="space-y-2 px-4">
              <p className="text-sm font-bold text-fg-muted">저장한 코스</p>
              {saved.map((c) => (
                <button
                  key={c.id}
                  onClick={() => navigate(`/course/${c.id}`)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-surface p-2 text-left active:brightness-110"
                >
                  <img src={c.thumbnail} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-extrabold">{c.name}</p>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-fg-muted">
                      <span>{c.area}</span>
                      <span>·</span>
                      <span>{formatDistance(c.distanceKm)}</span>
                      <span>·</span>
                      <span>약 {c.estMinutes}분</span>
                      <span>·</span>
                      <DifficultyBadge level={c.difficulty} className="text-xs" />
                    </div>
                  </div>
                  <Heart size={20} className="shrink-0 fill-primary text-primary" />
                </button>
              ))}
            </section>
          )}

          {/* 내가 만든 경로 (커스텀) */}
          {customRoutes.length > 0 && (
            <section className="space-y-2 px-4">
              <div className="flex items-center gap-1.5">
                <Route size={15} className="text-primary" />
                <p className="text-sm font-bold text-fg-muted">내가 만든 경로</p>
              </div>
              {customRoutes.map((r) => (
                <div key={r.id} className="rounded-2xl bg-surface p-2">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => navigate(`/explore?view=adventure&route=${encodeURIComponent(r.id)}`)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left active:brightness-110"
                    >
                      <div className="relative h-16 w-16 shrink-0">
                        <img src={thumbFor(r.id)} alt="" className="h-full w-full rounded-xl object-cover" />
                        <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 backdrop-blur">
                          {r.kind === 'ai' ? (
                            <Sparkles size={11} className="text-[#c4b5fd]" />
                          ) : (
                            <Footprints size={11} className="text-primary" />
                          )}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-extrabold">{r.name}</p>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-fg-muted">
                          <span>{r.kind === 'ai' ? 'AI 경로' : '자유 산책'}</span>
                          <span>·</span>
                          <span>{formatDistance(r.distanceKm)}</span>
                          <span>·</span>
                          <span>약 {r.estMinutes}분</span>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => removeRoute(r.id)}
                      className="mr-1 shrink-0 p-1"
                      aria-label="경로 삭제"
                    >
                      <Heart size={20} className="fill-primary text-primary" />
                    </button>
                  </div>
                  <ShareControl route={r} />
                </div>
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  )
}

/** 커스텀 경로의 공유/검토 상태 푸터 (F3). */
function ShareControl({ route }: { route: CustomRoute }) {
  const share = useCustomRoutes((s) => s.share)
  const unshare = useCustomRoutes((s) => s.unshare)
  const status = route.shareStatus

  if (status === 'private') {
    return (
      <div className="mt-1.5 border-t border-border/60 pt-1.5">
        <button
          onClick={() => share(route.id)}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-surface-2 py-2 text-sm font-bold active:brightness-110"
        >
          <Share2 size={15} className="text-primary" />
          공유하기
        </button>
        <p className="mt-1 px-1 text-[11px] leading-tight text-fg-muted">
          공유하면 검토 후 다른 사용자에게 공개돼요. 개인 위치·집 주변 노출에 유의하세요.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-1.5 flex items-center justify-between border-t border-border/60 pt-2">
      {status === 'pending' && (
        <span className="flex items-center gap-1.5 text-xs font-bold text-fg-muted">
          <Clock size={14} />
          검토중…
        </span>
      )}
      {status === 'approved' && (
        <span className="flex items-center gap-1.5 text-xs font-bold text-primary">
          <Check size={14} />
          공유 승인됨
          <span className="ml-1 flex items-center gap-1 font-normal text-fg-muted">
            <Users size={12} />
            {route.usageCount ?? 0}회 사용
          </span>
        </span>
      )}
      {status === 'rejected' && (
        <span className="text-xs font-bold text-red-400">공유 반려됨</span>
      )}
      {status !== 'rejected' && (
        <button
          onClick={() => unshare(route.id)}
          className="shrink-0 px-2 py-1 text-xs font-bold text-fg-muted active:text-fg"
        >
          공유 취소
        </button>
      )}
    </div>
  )
}
