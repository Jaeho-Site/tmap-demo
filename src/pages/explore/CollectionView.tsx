import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { getCourses } from '@/features/recommend/courses'
import {
  getDistrictProgress,
  getOverallPct,
  getExploredIds,
  getBadges,
  rarityOf,
} from '@/features/explore/collection'
import { ExploreToggle, type ExploreView } from '@/components/explore/ExploreToggle'
import { formatDistance } from '@/lib/geo'

export function CollectionView({
  view,
  onView,
}: {
  view: ExploreView
  onView: (v: ExploreView) => void
}) {
  const navigate = useNavigate()
  const overall = useMemo(() => getOverallPct(), [])
  const districts = useMemo(() => getDistrictProgress(), [])
  const badges = useMemo(() => getBadges(), [])
  const explored = useMemo(() => getExploredIds(), [])
  const dex = useMemo(() => {
    // 희귀도 높은 순으로 도감 12개(수집 완료가 앞으로)
    const order = ['전설', '영웅', '희귀', '일반']
    return [...getCourses()]
      .sort((a, b) => {
        const ea = explored.has(a.id) ? 0 : 1
        const eb = explored.has(b.id) ? 0 : 1
        if (ea !== eb) return ea - eb
        return order.indexOf(rarityOf(a).tier) - order.indexOf(rarityOf(b).tier)
      })
      .slice(0, 12)
  }, [explored])

  const earnedCount = badges.filter((b) => b.earned).length

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex justify-center px-4 pt-3">
        <ExploreToggle view={view} onChange={onView} />
      </div>

      <div className="px-4 pb-8 pt-4">
        <h1 className="text-2xl font-extrabold">대전 탐험</h1>

        {/* 전체 정복도 */}
        <div className="mt-4 rounded-[20px] bg-surface p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-bold text-fg-muted">전체 정복도</span>
            <span className="text-2xl font-extrabold text-primary">{overall}%</span>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-primary" style={{ width: `${overall}%` }} />
          </div>
          <p className="mt-2 text-xs text-fg-muted">
            안 걸은 길을 걸을수록 도감이 채워지고, 그 걸음이 코스 데이터를 검증해요.
          </p>
        </div>

        {/* 구별 정복 */}
        <p className="mt-6 mb-2 text-sm font-bold text-fg-muted">구별 정복</p>
        <div className="space-y-2.5 rounded-[20px] bg-surface p-4">
          {districts.map((d) => (
            <div key={d.district}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-bold">{d.district}</span>
                <span className="text-fg-muted">
                  {d.walked}/{d.total} · {d.pct}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-primary" style={{ width: `${d.pct}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* 배지 */}
        <div className="mt-6 mb-2 flex items-center justify-between">
          <p className="text-sm font-bold text-fg-muted">배지</p>
          <span className="text-sm font-bold text-primary">
            {earnedCount}/{badges.length}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {badges.map((b) => (
            <div
              key={b.id}
              className={`flex flex-col items-center gap-1 rounded-2xl bg-surface p-3 text-center ${
                b.earned ? '' : 'opacity-45'
              }`}
            >
              <span className="text-3xl">{b.earned ? b.emoji : '🔒'}</span>
              <span className="text-xs font-extrabold">{b.label}</span>
              <span className="text-[10px] leading-tight text-fg-muted">{b.desc}</span>
            </div>
          ))}
        </div>

        {/* 경로 도감 */}
        <p className="mt-6 mb-2 text-sm font-bold text-fg-muted">경로 도감</p>
        <div className="grid grid-cols-2 gap-3">
          {dex.map((c) => {
            const collected = explored.has(c.id)
            const rarity = rarityOf(c)
            return (
              <button
                key={c.id}
                onClick={() => navigate(`/course/${c.id}`)}
                className="overflow-hidden rounded-[18px] bg-surface text-left active:brightness-110"
              >
                <div className="relative h-24 w-full">
                  <img
                    src={c.thumbnail}
                    alt=""
                    className={`h-full w-full object-cover ${collected ? '' : 'grayscale brightness-50'}`}
                  />
                  {!collected && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Lock size={20} className="text-white/80" />
                    </div>
                  )}
                  <span
                    className={`absolute left-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-extrabold backdrop-blur ${rarity.cls}`}
                  >
                    {rarity.tier}
                  </span>
                </div>
                <div className="p-2.5">
                  <p className="truncate text-sm font-extrabold">
                    {collected ? c.name : '미개봉'}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-fg-muted">
                    {c.area} · {formatDistance(c.distanceKm)}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
