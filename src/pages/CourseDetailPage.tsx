import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Heart, MapPin, Flag, CircleDot } from 'lucide-react'
import { useTmapSdk } from '@/hooks/useTmapSdk'
import { getCourseMap } from '@/features/recommend/courses'
import { getCourseCautions } from '@/features/feedback/quality'
import { buildReason } from '@/features/recommend/reason'
import { useConditions } from '@/store/conditions'
import { useSaved } from '@/store/saved'
import { PURPOSES } from '@/data/daejeonData'
import { TmapMap } from '@/components/map/TmapMap'
import { Button } from '@/components/ui/Button'
import { DifficultyBadge, ConfidenceBadge } from '@/components/ui/Badge'
import { formatDistance } from '@/lib/geo'
import type { Waypoint } from '@/types/course'

const WAYPOINT_ICON = { start: CircleDot, via: MapPin, turn: MapPin, end: Flag } as const

export function CourseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { status } = useTmapSdk()
  const courseMap = useMemo(() => getCourseMap(), [])
  const minutes = useConditions((s) => s.minutes)
  const difficulty = useConditions((s) => s.difficulty)
  const purposes = useConditions((s) => s.purposes)
  const savedIds = useSaved((s) => s.ids)
  const toggleSaved = useSaved((s) => s.toggle)
  const isSaved = id ? savedIds.includes(id) : false

  const course = id ? courseMap.get(id) : undefined
  const cautions = useMemo(() => (id ? getCourseCautions(id) : []), [id])
  const single = useMemo(() => (course ? [course] : []), [course])
  const reason = useMemo(
    () => (course ? buildReason(course, { minutes, difficulty, purposes }) : ''),
    [course, minutes, difficulty, purposes],
  )

  if (!course) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-bg px-8 text-center">
        <p className="font-extrabold">코스를 찾을 수 없어요</p>
        <Button onClick={() => navigate('/')}>홈으로</Button>
      </div>
    )
  }

  const purposeLabels = PURPOSES.filter((p) => course.purposes.includes(p.id))

  return (
    <div className="relative flex h-screen flex-col bg-bg">
      {/* 지도 */}
      <div className="relative h-[42vh] shrink-0">
        {status === 'ready' ? (
          <TmapMap className="absolute inset-0" courses={single} selectedId={course.id} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-fg-muted">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-primary" />
          </div>
        )}
        <button
          onClick={() => navigate(-1)}
          className="absolute left-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-surface/95 backdrop-blur shadow-[0_2px_10px_rgba(0,0,0,0.45)]"
          aria-label="뒤로"
        >
          <ChevronLeft size={22} />
        </button>
        <button
          onClick={() => toggleSaved(course.id)}
          className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-surface/95 backdrop-blur shadow-[0_2px_10px_rgba(0,0,0,0.45)]"
          aria-label="저장"
        >
          <Heart size={20} className={isSaved ? 'fill-primary text-primary' : ''} />
        </button>
      </div>

      {/* 상세 (스크롤) */}
      <div className="flex-1 overflow-y-auto rounded-t-[24px] bg-bg -mt-6 relative z-10">
        <div className="px-4 pt-5 pb-28">
          <h1 className="text-2xl font-extrabold">{course.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-fg-muted">
            <span>{course.area}</span>
            <span>·</span>
            <span>{formatDistance(course.distanceKm)}</span>
            <span>·</span>
            <span>약 {course.estMinutes}분</span>
            <span>·</span>
            <DifficultyBadge level={course.difficulty} />
          </div>

          {/* 목적 + 신뢰도 */}
          <div className="mt-4 flex flex-wrap gap-2">
            {purposeLabels.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-sm font-bold"
              >
                {p.emoji} {p.label}
                {course.confidence[p.id] && (
                  <ConfidenceBadge level={course.confidence[p.id]!} />
                )}
              </span>
            ))}
          </div>

          {/* 이유 */}
          <p className="mt-4 text-[15px] leading-relaxed">{reason}</p>

          {/* 코스 주의 사항 (피드백 반영, E7) */}
          {cautions.length > 0 && (
            <div className="mt-4 rounded-2xl bg-danger/10 p-3">
              <p className="mb-1.5 text-sm font-extrabold text-danger">⚠️ 걷는 분들이 알려준 주의</p>
              <div className="flex flex-wrap gap-1.5">
                {cautions.map((c) => (
                  <span
                    key={c.label}
                    className="rounded-full bg-danger/15 px-2.5 py-1 text-xs font-bold text-danger"
                  >
                    {c.label} · {c.level}
                    {c.count > 1 ? ` ${c.count}건` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 핵심 지점 */}
          <p className="mt-6 mb-2 text-sm font-extrabold">핵심 지점</p>
          <div className="rounded-[20px] bg-surface p-2">
            {course.waypoints.map((w: Waypoint, i) => {
              const Icon = WAYPOINT_ICON[w.kind]
              return (
                <div key={i} className="flex items-center gap-3 p-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-primary">
                    <Icon size={18} />
                  </div>
                  <span className="font-bold">{w.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 하단 고정 CTA */}
      <div className="absolute inset-x-0 bottom-0 z-20 border-t border-border bg-bg p-4 pb-[max(env(safe-area-inset-bottom),16px)]">
        <Button size="lg" className="w-full" onClick={() => navigate(`/walk/${course.id}`)}>
          산책 시작
        </Button>
      </div>
    </div>
  )
}
