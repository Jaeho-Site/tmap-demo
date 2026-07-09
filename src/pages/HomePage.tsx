import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Cloud, SlidersHorizontal, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { DifficultyBadge, ConfidenceBadge } from '@/components/ui/Badge'
import { ConditionSheet } from '@/components/recommend/ConditionSheet'
import { getCourses } from '@/features/recommend/courses'
import { rankCourses } from '@/features/recommend/engine'
import { buildReason } from '@/features/recommend/reason'
import { recordSignal } from '@/features/feedback/signals'
import { useConditions } from '@/store/conditions'
import { useGeolocation } from '@/hooks/useGeolocation'
import { DAEJEON_CENTER } from '@/config'
import { PURPOSES } from '@/data/daejeonData'
import { formatDistance } from '@/lib/geo'

export function HomePage() {
  const navigate = useNavigate()
  const courses = useMemo(() => getCourses(), [])
  const { coords, request } = useGeolocation()
  const minutes = useConditions((s) => s.minutes)
  const difficulty = useConditions((s) => s.difficulty)
  const purposes = useConditions((s) => s.purposes)
  const togglePurpose = useConditions((s) => s.togglePurpose)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    request()
  }, [request])

  const origin = coords ?? DAEJEON_CENTER
  const cond = useMemo(() => ({ minutes, difficulty, purposes }), [minutes, difficulty, purposes])
  const ranked = useMemo(
    () => rankCourses(courses, origin, cond),
    [courses, origin, cond],
  )

  // 조건/위치가 바뀌면 대표 추천을 맨 위부터 다시
  useEffect(() => {
    setIndex(0)
  }, [cond, origin])

  const primary = ranked[index % ranked.length]
  const reason = useMemo(() => (primary ? buildReason(primary, cond) : ''), [primary, cond])

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

      {/* 목적 빠른 선택 + 조건 진입 */}
      <div className="mt-4 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
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

      <ConditionSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  )
}
