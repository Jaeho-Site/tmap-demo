import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Cloud,
  SlidersHorizontal,
  RefreshCw,
  Sparkles,
  Footprints,
  Flame,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { DifficultyBadge, ConfidenceBadge } from '@/components/ui/Badge'
import { ConditionSheet } from '@/components/recommend/ConditionSheet'
import { getCourses, getCourseMap } from '@/features/recommend/courses'
import { rankCourses } from '@/features/recommend/engine'
import { buildReason } from '@/features/recommend/reason'
import { recordSignal } from '@/features/feedback/signals'
import { listWalks } from '@/features/history/records'
import { computeStats } from '@/features/history/stats'
import { useConditions } from '@/store/conditions'
import { useSaved } from '@/store/saved'
import { useGeolocation } from '@/hooks/useGeolocation'
import { DAEJEON_CENTER } from '@/config'
import { PURPOSES } from '@/data/daejeonData'
import { formatDistance } from '@/lib/geo'
import { estimateKcal, estimateSteps } from '@/lib/format'
import type { Course } from '@/types/course'

export function HomePage() {
  const navigate = useNavigate()
  const courses = useMemo(() => getCourses(), [])
  const courseMap = useMemo(() => getCourseMap(), [])
  const { coords, request } = useGeolocation()
  const minutes = useConditions((s) => s.minutes)
  const difficulty = useConditions((s) => s.difficulty)
  const purposes = useConditions((s) => s.purposes)
  const togglePurpose = useConditions((s) => s.togglePurpose)
  const savedIds = useSaved((s) => s.ids)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    request()
  }, [request])

  const stats = useMemo(() => computeStats(listWalks()), [])

  const origin = coords ?? DAEJEON_CENTER
  const cond = useMemo(() => ({ minutes, difficulty, purposes }), [minutes, difficulty, purposes])
  const ranked = useMemo(() => rankCourses(courses, origin, cond), [courses, origin, cond])

  // 조건/위치가 바뀌면 대표 추천을 맨 위부터 다시
  useEffect(() => {
    setIndex(0)
  }, [cond, origin])

  const primary = ranked[index % ranked.length]
  const reason = useMemo(() => (primary ? buildReason(primary, cond) : ''), [primary, cond])

  // 자주 찾는 코스 — 많이 걸은 순 + 저장, 없으면 가까운 추천으로 폴백
  const frequent = useMemo(() => {
    const freq = new Map<string, number>()
    for (const r of listWalks()) freq.set(r.courseId, (freq.get(r.courseId) ?? 0) + 1)
    const walkedIds = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
    const ids = [...new Set([...walkedIds, ...savedIds])]
    const list = ids
      .map((id) => courseMap.get(id))
      .filter((c): c is Course => !!c)
    return { list: list.slice(0, 8), personalized: list.length > 0 }
  }, [savedIds, courseMap])

  const frequentList = frequent.personalized ? frequent.list : ranked.slice(1, 7)

  // 대표 추천 노출 = 암묵 view 신호
  useEffect(() => {
    if (primary) recordSignal('view', primary.id)
  }, [primary])

  const start = () => {
    if (!primary) return
    recordSignal('start', primary.id)
    navigate(`/course/${primary.id}`)
  }
  const another = () => {
    if (primary) recordSignal('skip', primary.id)
    setIndex((i) => i + 1)
  }

  const todaySteps = estimateSteps(stats.todayDistanceM)
  const todayKcal = estimateKcal(stats.todayDistanceM)

  return (
    <div className="px-4 pt-4 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-fg-muted">지금, 여기서</p>
          <h1 className="text-2xl font-extrabold leading-tight">바로 걷기 시작해요</h1>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-2 text-sm font-bold">
          <Cloud size={16} className="text-fg-muted" />
          24° · 미세 좋음
        </div>
      </div>

      {/* 빠른 시작 — 서비스 메인 기능 진입 */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate('/explore?view=adventure&ai=1')}
          className="flex flex-col justify-between rounded-3xl bg-primary p-4 text-left text-on-primary active:scale-[0.98] transition-transform min-h-[128px]"
        >
          <Sparkles size={26} />
          <div>
            <p className="text-lg font-extrabold leading-tight">AI 경로 추천</p>
            <p className="mt-0.5 text-[13px] font-bold opacity-80">조건 맞춤 코스 만들기</p>
          </div>
        </button>
        <button
          onClick={() => navigate('/explore?view=adventure')}
          className="flex flex-col justify-between rounded-3xl bg-surface border border-border p-4 text-left active:scale-[0.98] transition-transform min-h-[128px]"
        >
          <Footprints size={26} className="text-primary" />
          <div>
            <p className="text-lg font-extrabold leading-tight">자유 산책</p>
            <p className="mt-0.5 text-[13px] font-bold text-fg-muted">걸으며 경로 만들기</p>
          </div>
        </button>
      </div>

      {/* 오늘의 활동 */}
      <Card className="mt-3">
        <div className="flex items-center justify-between px-4 pt-3">
          <p className="text-sm font-extrabold">오늘의 활동</p>
          <div className="flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-extrabold text-primary">
            <Flame size={13} /> 연속 {stats.dayStreak}일
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-border">
          <TodayStat value={todaySteps.toLocaleString()} label="걸음수" />
          <TodayStat value={`${todayKcal}`} label="칼로리" />
          <TodayStat value={formatDistance(Math.round(stats.todayDistanceM) / 1000)} label="거리" />
        </div>
        {stats.todayWalks === 0 && (
          <p className="px-4 pb-3 pt-1 text-center text-xs text-fg-muted">
            아직 오늘 걸음이 없어요. 첫 산책을 시작해볼까요?
          </p>
        )}
      </Card>

      {/* 목적 빠른 선택 + 조건 진입 */}
      <div className="mt-5 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {PURPOSES.map((p) => (
          <Chip key={p.id} selected={purposes.includes(p.id)} onClick={() => togglePurpose(p.id)}>
            {p.emoji} {p.label}
          </Chip>
        ))}
        <Chip onClick={() => setSheetOpen(true)}>
          <SlidersHorizontal size={15} /> 조건
        </Chip>
      </div>

      <p className="mt-6 mb-2 text-sm font-bold text-fg-muted">오늘의 추천 코스</p>

      {primary && (
        <Card>
          <button onClick={start} className="block w-full text-left">
            <div className="relative h-44 w-full">
              <img src={primary.thumbnail} alt="" className="h-full w-full object-cover" />
              {primary.confidence[primary.purposes[0]] === 'verified' && (
                <div className="absolute left-3 top-3">
                  <ConfidenceBadge level="verified" className="bg-black/55 text-primary backdrop-blur" />
                </div>
              )}
            </div>
            <div className="p-4 pb-0">
              <h2 className="text-xl font-extrabold">{primary.name}</h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-fg-muted">
                <span>{primary.area}</span>
                <span>·</span>
                <span>{formatDistance(primary.distanceKm)}</span>
                <span>·</span>
                <span>약 {primary.estMinutes}분</span>
                <span>·</span>
                <DifficultyBadge level={primary.difficulty} />
              </div>
              <p className="mt-3 text-[15px] leading-relaxed">{reason}</p>
            </div>
          </button>

          <div className="flex gap-2 p-4">
            <Button size="lg" className="flex-1" onClick={start}>
              산책 시작
            </Button>
            <Button variant="surface" size="lg" onClick={another} aria-label="다른 코스 보기">
              <RefreshCw size={18} /> 다른 코스
            </Button>
          </div>
        </Card>
      )}

      {/* 자주 찾는 코스 */}
      {frequentList.length > 0 && (
        <>
          <div className="mt-6 mb-2 flex items-center justify-between">
            <p className="text-sm font-bold text-fg-muted">
              {frequent.personalized ? '자주 찾는 코스' : '가까운 코스 둘러보기'}
            </p>
            <button
              onClick={() => navigate(frequent.personalized ? '/saved' : '/explore')}
              className="flex items-center text-sm font-bold text-primary"
            >
              전체 <ChevronRight size={16} />
            </button>
          </div>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {frequentList.map((c) => (
              <button
                key={c.id}
                onClick={() => navigate(`/course/${c.id}`)}
                className="w-40 shrink-0 overflow-hidden rounded-2xl bg-surface text-left active:brightness-110"
              >
                <img src={c.thumbnail} alt="" className="h-24 w-full object-cover" />
                <div className="p-2.5">
                  <p className="truncate text-sm font-extrabold">{c.name}</p>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-fg-muted">
                    <span>{formatDistance(c.distanceKm)}</span>
                    <span>·</span>
                    <span>{c.estMinutes}분</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <ConditionSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  )
}

function TodayStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 py-3">
      <span className="text-xl font-extrabold tabular-nums">{value}</span>
      <span className="text-[11px] text-fg-muted">{label}</span>
    </div>
  )
}
