import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Sparkles, Play, Pause, Flag, X, Footprints, RotateCcw, Navigation, Heart } from 'lucide-react'
import { useTmapSdk } from '@/hooks/useTmapSdk'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useFreeWalk } from '@/features/walk/useFreeWalk'
import {
  suggestRoute,
  MOODS,
  DISTANCES,
  type SuggestedRoute,
  type TripType,
} from '@/features/adventure/suggestRoute'
import { saveWalk } from '@/features/history/records'
import { useCustomRoutes, type CustomRoute } from '@/store/customRoutes'
import { getSharedById, type SharedRoute } from '@/features/community/sharedRoutes'
import { DAEJEON_CENTER } from '@/config'
import { TmapMap, type TmapMapHandle } from '@/components/map/TmapMap'
import { MapControls } from '@/components/map/MapControls'
import { ExploreToggle, type ExploreView } from '@/components/explore/ExploreToggle'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Sheet } from '@/components/ui/Sheet'
import { formatDuration, formatMetersKm } from '@/lib/format'
import type { Course, LatLng } from '@/types/course'
import type { WalkRecord } from '@/types/walk'

const NO_COURSES: Course[] = []

export function AdventureView({
  view,
  onView,
}: {
  view: ExploreView
  onView: (v: ExploreView) => void
}) {
  const { status: sdk, error } = useTmapSdk()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const mapHandle = useRef<TmapMapHandle>(null)
  const { coords, loading, request } = useGeolocation()
  const session = useFreeWalk()
  const saveRoute = useCustomRoutes((s) => s.save)
  const removeRoute = useCustomRoutes((s) => s.remove)
  const savedRoutes = useCustomRoutes((s) => s.routes)
  const bumpUsage = useCustomRoutes((s) => s.bumpUsage)

  const [route, setRoute] = useState<SuggestedRoute | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [generating, setGenerating] = useState(false)

  // AI 추천 조건(폼 상태) — 시트를 다시 열어도 유지
  const [distanceKm, setDistanceKm] = useState(2)
  const [trip, setTrip] = useState<TripType>('round')
  const [moodId, setMoodId] = useState(MOODS[0].id)
  const [note, setNote] = useState('')

  const endedRef = useRef(false)
  const recording = session.status !== 'idle'
  const origin = coords ?? DAEJEON_CENTER

  useEffect(() => {
    request()
  }, [request])

  // 진입 딥링크 처리(1회): ?ai=1 → 조건 폼 자동 오픈 / ?route=<id> → 저장 경로 불러오기
  useEffect(() => {
    const routeId = params.get('route')
    if (routeId) {
      const s = getSharedById(routeId)
      if (s) {
        setRoute(sharedToSuggested(s))
        mapHandle.current?.panTo(s.path[Math.floor(s.path.length / 2)], 15)
      }
    } else if (params.get('ai') === '1') {
      setFormOpen(true)
    }
    if (params.has('ai') || params.has('route')) {
      params.delete('ai')
      params.delete('route')
      setParams(params, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const routeSaved = route ? savedRoutes.some((r) => r.id === route.id) : false
  const toggleSaveRoute = () => {
    if (!route) return
    if (routeSaved) removeRoute(route.id)
    else saveRoute(suggestedToCustom(route))
  }

  // 대기 중엔 현위치로, 기록 중엔 이동 위치로 지도 추적
  useEffect(() => {
    if (!recording && coords) mapHandle.current?.panTo(coords, 16)
  }, [coords, recording])
  useEffect(() => {
    if (session.userPos) mapHandle.current?.panTo(session.userPos)
  }, [session.userPos])

  // 종료 → 기록 저장 후 완료 화면(피드백·회고 재사용)
  useEffect(() => {
    if (session.status !== 'done' || endedRef.current) return
    endedRef.current = true
    const record: WalkRecord = {
      id: `w-${Date.now()}`,
      courseId: route ? route.id : `free-${Date.now()}`,
      courseName: route ? route.name : '자유 산책',
      area: '내 주변',
      startedAt: session.startedAt,
      endedAt: Date.now(),
      durationSec: session.elapsedSec,
      distanceM: Math.round(session.distanceM),
      completed: true,
      notes: [],
      track: session.track.slice(),
    }
    saveWalk(record)
    navigate(`/complete/${record.id}`)
  }, [session.status, session.startedAt, session.elapsedSec, session.distanceM, session.track, route, navigate])

  const generate = async () => {
    setGenerating(true)
    const r = await suggestRoute(origin, { distanceKm, trip, moodId, note })
    setRoute(r)
    setGenerating(false)
    setFormOpen(false)
    mapHandle.current?.panTo(r.path[Math.floor(r.path.length / 2)], 15)
  }

  const startFree = () => {
    setRoute(null)
    // 위치 권한이 없어도(coords null) 시뮬레이터가 배회할 시작점을 보장
    session.start({ origin })
  }
  const startRoute = () => {
    if (!route) return
    bumpUsage(route.id) // 저장·공유된 경로면 사용수 +1 (미저장 경로는 무영향)
    session.start({ guide: route.path, origin: route.path[0] })
  }
  const cancelWalk = () => {
    session.cancel()
    endedRef.current = false
  }

  const guidePath: LatLng[] | null = route ? route.path : null

  return (
    <div className="relative h-full w-full overflow-hidden">
      {sdk === 'ready' && (
        <TmapMap
          ref={mapHandle}
          className="absolute inset-0"
          courses={NO_COURSES}
          userLocation={session.userPos ?? coords}
          guidePath={guidePath}
          livePath={recording ? session.track : null}
        />
      )}
      {sdk === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-fg-muted">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
          <p className="text-sm">TMAP 지도 불러오는 중…</p>
        </div>
      )}
      {sdk === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-8 text-center">
          <p className="font-extrabold">지도를 불러오지 못했어요</p>
          <p className="text-sm text-fg-muted">{error}</p>
        </div>
      )}

      {!recording && (
        <>
          <ExploreToggle
            view={view}
            onChange={onView}
            className="absolute left-1/2 top-3 z-30 -translate-x-1/2"
          />
          <MapControls
            className="absolute right-3 top-20 z-10"
            onZoomIn={() => mapHandle.current?.zoomIn()}
            onZoomOut={() => mapHandle.current?.zoomOut()}
            onLocate={request}
            locating={loading}
          />
          <SetupSheet
            route={route}
            saved={routeSaved}
            onToggleSave={toggleSaveRoute}
            onOpenForm={() => setFormOpen(true)}
            onClearRoute={() => setRoute(null)}
            onStartFree={startFree}
            onStartRoute={startRoute}
          />
          <RouteForm
            open={formOpen}
            onClose={() => setFormOpen(false)}
            distanceKm={distanceKm}
            onDistance={setDistanceKm}
            trip={trip}
            onTrip={setTrip}
            moodId={moodId}
            onMood={setMoodId}
            note={note}
            onNote={setNote}
            generating={generating}
            onSubmit={generate}
          />
        </>
      )}

      {recording && <RecordingOverlay session={session} onCancel={cancelWalk} guided={!!route} />}
    </div>
  )
}

function SetupSheet({
  route,
  saved,
  onToggleSave,
  onOpenForm,
  onClearRoute,
  onStartFree,
  onStartRoute,
}: {
  route: SuggestedRoute | null
  saved: boolean
  onToggleSave: () => void
  onOpenForm: () => void
  onClearRoute: () => void
  onStartFree: () => void
  onStartRoute: () => void
}) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 space-y-3 rounded-t-[24px] bg-surface p-4 pb-[max(env(safe-area-inset-bottom),16px)] shadow-[0_-4px_24px_rgba(0,0,0,0.5)]">
      <div className="flex justify-center pb-0.5">
        <div className="h-1.5 w-10 rounded-full bg-surface-2" />
      </div>

      <div className="flex items-center gap-2">
        <Footprints size={20} className="text-primary" />
        <p className="text-lg font-extrabold">모험 · 내가 만드는 산책</p>
      </div>
      <p className="text-sm text-fg-muted">
        현위치에서 바로 걸으며 나만의 경로를 남기거나, AI에게 조건을 알려주고 코스를 추천받으세요.
      </p>

      {/* AI 추천 경로 프리뷰 */}
      {route ? (
        <div className="rounded-2xl bg-surface-2 p-3.5">
          <div className="mb-1 flex items-center gap-1.5">
            <Sparkles size={15} className="text-[#a78bfa]" />
            <span className="text-xs font-extrabold text-[#a78bfa]">AI 추천 · 베타</span>
            <button
              onClick={onToggleSave}
              className="ml-auto flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs font-bold active:scale-95 transition-transform"
              aria-label={saved ? '경로 저장 해제' : '경로 저장'}
            >
              <Heart size={14} className={saved ? 'fill-primary text-primary' : 'text-fg-muted'} />
              {saved ? '저장됨' : '저장'}
            </button>
          </div>
          <p className="font-extrabold">{route.name}</p>
          <p className="mt-0.5 text-sm text-fg-muted">
            약 {route.distanceKm} km · {route.estMinutes}분
          </p>
          <p className="mt-2 text-xs leading-relaxed text-fg-muted">{route.summary}</p>
          <div className="mt-3 flex gap-2">
            <Button variant="surface" size="md" className="flex-1" onClick={onOpenForm}>
              <RotateCcw size={16} /> 다시
            </Button>
            <Button variant="surface" size="md" onClick={onClearRoute} aria-label="추천 지우기">
              <X size={18} />
            </Button>
            <Button size="md" className="flex-[2]" onClick={onStartRoute}>
              <Navigation size={16} /> 이 경로로 시작
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="surface" size="lg" className="w-full" onClick={onOpenForm}>
          <Sparkles size={18} className="text-[#a78bfa]" /> AI 경로 추천받기
        </Button>
      )}

      <Button size="lg" className="w-full" onClick={onStartFree}>
        <Play size={18} /> 자유 산책 시작
      </Button>
    </div>
  )
}

function RouteForm({
  open,
  onClose,
  distanceKm,
  onDistance,
  trip,
  onTrip,
  moodId,
  onMood,
  note,
  onNote,
  generating,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  distanceKm: number
  onDistance: (v: number) => void
  trip: TripType
  onTrip: (v: TripType) => void
  moodId: string
  onMood: (v: string) => void
  note: string
  onNote: (v: string) => void
  generating: boolean
  onSubmit: () => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title="AI 경로 추천">
      <p className="mb-4 text-sm text-fg-muted">
        원하는 조건을 알려주시면 현위치 기준으로 코스를 만들어 드려요.
      </p>

      {/* 1. 산책 거리 */}
      <FormLabel>산책 거리</FormLabel>
      <div className="mb-5 flex gap-2">
        {DISTANCES.map((d) => (
          <Chip key={d} selected={distanceKm === d} onClick={() => onDistance(d)}>
            {d} km
          </Chip>
        ))}
      </div>

      {/* 2. 왕복 / 편도 */}
      <FormLabel>코스 형태</FormLabel>
      <div className="mb-5 flex gap-2">
        <Chip selected={trip === 'round'} onClick={() => onTrip('round')}>
          🔄 왕복 (제자리로)
        </Chip>
        <Chip selected={trip === 'oneway'} onClick={() => onTrip('oneway')}>
          ➡️ 편도 (쭉 가기)
        </Chip>
      </div>

      {/* 3. 산책 테마 */}
      <FormLabel>산책 테마</FormLabel>
      <div className="mb-5 flex flex-wrap gap-2">
        {MOODS.map((m) => (
          <Chip key={m.id} selected={moodId === m.id} onClick={() => onMood(m.id)}>
            {m.emoji} {m.label}
          </Chip>
        ))}
      </div>

      {/* 4. 추가 요청(자연어) */}
      <FormLabel>추가 요청 (선택)</FormLabel>
      <textarea
        value={note}
        onChange={(e) => onNote(e.target.value)}
        rows={2}
        placeholder="예: 그늘이 많은 길로, 사람 적고 조용한 곳으로"
        className="mb-6 w-full resize-none rounded-2xl bg-surface-2 px-4 py-3 text-sm outline-none placeholder:text-fg-muted"
      />

      <Button size="lg" className="w-full" disabled={generating} onClick={onSubmit}>
        {generating ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-on-primary border-t-transparent" />
            경로 만드는 중…
          </>
        ) : (
          <>
            <Sparkles size={18} /> 이 조건으로 추천받기
          </>
        )}
      </Button>
    </Sheet>
  )
}

function FormLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-sm font-extrabold">{children}</p>
}

/* ── 커스텀 경로 ↔ 추천 경로 표시 모델 변환 ─────────────────────────────── */
function suggestedToCustom(r: SuggestedRoute): CustomRoute {
  return {
    id: r.id,
    name: r.name,
    kind: 'ai',
    distanceKm: r.distanceKm,
    estMinutes: r.estMinutes,
    path: r.path,
    trip: r.trip,
    shareStatus: 'private',
    createdAt: Date.now(),
  }
}
function sharedToSuggested(s: SharedRoute): SuggestedRoute {
  return {
    id: s.id,
    name: s.name,
    distanceKm: s.distanceKm,
    estMinutes: s.estMinutes,
    trip: 'round',
    path: s.path,
    waypoints: [s.path[0], s.path[Math.floor(s.path.length / 2)], s.path[s.path.length - 1]],
    summary: s.kind === 'ai' ? '저장해 둔 AI 추천 경로예요.' : '저장해 둔 나의 산책 경로예요.',
  }
}

function RecordingOverlay({
  session,
  onCancel,
  guided,
}: {
  session: ReturnType<typeof useFreeWalk>
  onCancel: () => void
  guided: boolean
}) {
  const paused = session.status === 'paused'
  return (
    <>
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
            {guided ? (
              <>
                <Navigation size={15} className="text-[#a78bfa]" /> 경로 안내
              </>
            ) : (
              <>
                <Footprints size={15} className="text-primary" /> 자유
              </>
            )}
          </div>
        </div>
      </div>

      {/* 나가기(기록 취소) */}
      <button
        onClick={onCancel}
        className="absolute left-3 top-[92px] z-10 flex h-10 w-10 items-center justify-center rounded-full bg-surface/95 backdrop-blur shadow-[0_2px_10px_rgba(0,0,0,0.45)]"
        aria-label="산책 취소"
      >
        <X size={20} />
      </button>

      {/* 시뮬레이터 토글(개발/데모) */}
      <button
        onClick={session.toggleSim}
        className="absolute right-3 top-[92px] z-10 flex items-center gap-1.5 rounded-full bg-surface/95 px-3 py-2 text-xs font-bold backdrop-blur shadow-[0_2px_10px_rgba(0,0,0,0.45)]"
      >
        {session.simulating ? <Pause size={14} /> : <Play size={14} />}
        {session.simulating ? '시뮬 정지' : '시뮬 걷기'}
      </button>

      {/* 하단: 일시정지/재개 + 종료 */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex gap-2 rounded-t-[24px] bg-surface p-4 pb-[max(env(safe-area-inset-bottom),16px)] shadow-[0_-4px_24px_rgba(0,0,0,0.5)]">
        <Button
          variant="surface"
          size="lg"
          className="flex-1"
          onClick={paused ? session.resume : session.pause}
        >
          {paused ? (
            <>
              <Play size={18} /> 이어서
            </>
          ) : (
            <>
              <Pause size={18} /> 일시정지
            </>
          )}
        </Button>
        <Button size="lg" className="flex-[1.4]" onClick={session.end}>
          <Flag size={18} /> 산책 종료
        </Button>
      </div>
    </>
  )
}
