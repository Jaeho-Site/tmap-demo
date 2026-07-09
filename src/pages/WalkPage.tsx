import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { X, Flag, Play, Pause, MapPin, Plus } from 'lucide-react'
import { useTmapSdk } from '@/hooks/useTmapSdk'
import { getCourseMap } from '@/features/recommend/courses'
import { useWalkSession } from '@/features/walk/useWalkSession'
import { saveWalk } from '@/features/history/records'
import { recordSignal } from '@/features/feedback/signals'
import { TmapMap, type TmapMapHandle } from '@/components/map/TmapMap'
import { Button } from '@/components/ui/Button'
import { formatDuration, formatMetersKm } from '@/lib/format'
import type { Course } from '@/types/course'
import type { WalkRecord } from '@/types/walk'

export function WalkPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { status: sdk } = useTmapSdk()
  const courseMap = useMemo(() => getCourseMap(), [])
  const course = id ? courseMap.get(id) : undefined

  if (!course) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-bg px-8 text-center">
        <p className="font-extrabold">코스를 찾을 수 없어요</p>
        <Button onClick={() => navigate('/')}>홈으로</Button>
      </div>
    )
  }
  return <WalkView key={course.id} course={course} sdkReady={sdk === 'ready'} />
}

function WalkView({ course, sdkReady }: { course: Course; sdkReady: boolean }) {
  const navigate = useNavigate()
  const single = useMemo(() => [course], [course])
  const mapHandle = useRef<TmapMapHandle>(null)
  const session = useWalkSession(course)
  const [notes, setNotes] = useState<string[]>([])
  const [memo, setMemo] = useState('')
  const endedRef = useRef(false)

  // 현위치 따라 지도 이동
  useEffect(() => {
    if (session.userPos) mapHandle.current?.panTo(session.userPos)
  }, [session.userPos])

  // 완주/종료 → 기록 저장 후 완료 화면으로
  useEffect(() => {
    if (session.status !== 'done' || endedRef.current) return
    endedRef.current = true
    const completed = session.nextIdx >= course.waypoints.length
    const record: WalkRecord = {
      id: `w-${Date.now()}`,
      courseId: course.id,
      courseName: course.name,
      area: course.area,
      startedAt: session.startedAt,
      endedAt: Date.now(),
      durationSec: session.elapsedSec,
      distanceM: Math.round(session.distanceM),
      completed,
      notes,
      track: session.track.slice(),
    }
    saveWalk(record)
    recordSignal(completed ? 'complete' : 'abandon', course.id)
    navigate(`/complete/${record.id}`, { replace: true })
  }, [session.status, session.nextIdx, session.elapsedSec, session.distanceM, session.startedAt, session.track, course, notes, navigate])

  const addMemo = () => {
    const m = memo.trim()
    if (!m) return
    setNotes((n) => [...n, m])
    setMemo('')
  }

  const nextWp = course.waypoints[Math.min(session.nextIdx, course.waypoints.length - 1)]

  return (
    <div className="relative h-screen w-full overflow-hidden bg-bg">
      {sdkReady && (
        <TmapMap
          ref={mapHandle}
          className="absolute inset-0"
          courses={single}
          selectedId={course.id}
          userLocation={session.userPos}
        />
      )}

      {/* 상단 진행 상태 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-3">
        <div className="pointer-events-auto flex items-center gap-4 rounded-2xl bg-surface/95 px-4 py-3 backdrop-blur shadow-[0_2px_12px_rgba(0,0,0,0.5)]">
          <div>
            <p className="text-xs text-fg-muted">시간</p>
            <p className="text-2xl font-extrabold tabular-nums leading-tight">
              {formatDuration(session.elapsedSec)}
            </p>
          </div>
          <div className="h-9 w-px bg-border" />
          <div>
            <p className="text-xs text-fg-muted">거리</p>
            <p className="text-2xl font-extrabold tabular-nums leading-tight">
              {formatMetersKm(session.distanceM)}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-sm font-bold">
            <MapPin size={15} className="text-primary" />
            {nextWp?.label ?? '도착'}
          </div>
        </div>
      </div>

      {/* 이탈 자동 질문 (US-3.5, dismissable) */}
      {session.offRoute && (
        <div className="absolute inset-x-3 top-[88px] z-20 flex items-center gap-3 rounded-2xl bg-danger/90 px-4 py-3 text-white shadow-lg backdrop-blur">
          <span className="flex-1 text-sm font-bold">경로를 벗어난 것 같아요. 길이 막혔거나 없나요?</span>
          <button onClick={session.dismissOffRoute} className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold">
            아니요
          </button>
        </div>
      )}

      {/* 시뮬레이터 토글(개발/데모) */}
      <button
        onClick={session.toggleSim}
        className="absolute right-3 top-[92px] z-10 flex items-center gap-1.5 rounded-full bg-surface/95 px-3 py-2 text-xs font-bold backdrop-blur shadow-[0_2px_10px_rgba(0,0,0,0.45)]"
      >
        {session.simulating ? <Pause size={14} /> : <Play size={14} />}
        {session.simulating ? '시뮬 정지' : '시뮬 걷기'}
      </button>

      {/* 하단: 메모 + 산책 종료 */}
      <div className="absolute inset-x-0 bottom-0 z-20 space-y-3 rounded-t-[24px] bg-surface p-4 pb-[max(env(safe-area-inset-bottom),16px)] shadow-[0_-4px_24px_rgba(0,0,0,0.5)]">
        {notes.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {notes.map((n, i) => (
              <span key={i} className="rounded-full bg-surface-2 px-3 py-1 text-xs">
                📝 {n}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addMemo()}
            placeholder="한 줄 메모 (예: 여기 그늘 좋다)"
            className="h-11 flex-1 rounded-full bg-surface-2 px-4 text-sm outline-none placeholder:text-fg-muted"
          />
          <button
            onClick={addMemo}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2"
            aria-label="메모 추가"
          >
            <Plus size={20} />
          </button>
        </div>
        <Button size="lg" className="w-full" onClick={session.endWalk}>
          <Flag size={18} /> 산책 종료
        </Button>
      </div>

      {/* 좌상단 나가기 */}
      <button
        onClick={() => navigate(-1)}
        className="absolute left-3 top-[92px] z-10 flex h-10 w-10 items-center justify-center rounded-full bg-surface/95 backdrop-blur shadow-[0_2px_10px_rgba(0,0,0,0.45)]"
        aria-label="나가기"
      >
        <X size={20} />
      </button>
    </div>
  )
}
