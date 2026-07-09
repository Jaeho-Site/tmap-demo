import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { useTmapSdk } from '@/hooks/useTmapSdk'
import { useGeolocation } from '@/hooks/useGeolocation'
import { getCourses } from '@/features/recommend/courses'
import { PURPOSES, type PurposeId } from '@/data/daejeonData'
import { DAEJEON_CENTER } from '@/config'
import { haversine, formatDistance } from '@/lib/geo'
import { TmapMap, type TmapMapHandle } from '@/components/map/TmapMap'
import { MapControls } from '@/components/map/MapControls'
import { MapWeatherWidget } from '@/components/map/MapWeatherWidget'
import { ExploreToggle, type ExploreView } from '@/components/explore/ExploreToggle'
import { Chip } from '@/components/ui/Chip'
import { DifficultyBadge } from '@/components/ui/Badge'
import type { Course } from '@/types/course'

export function MapExplore({ view, onView }: { view: ExploreView; onView: (v: ExploreView) => void }) {
  const { status, error } = useTmapSdk()
  const courses = useMemo(() => getCourses(), [])
  const mapHandle = useRef<TmapMapHandle>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<PurposeId | null>(null)
  const { coords, loading, request } = useGeolocation()

  useEffect(() => {
    request()
  }, [request])
  useEffect(() => {
    if (coords) mapHandle.current?.panTo(coords, 15)
  }, [coords])

  const origin = coords ?? DAEJEON_CENTER
  const nearby = useMemo(() => {
    const list = filter ? courses.filter((c) => c.purposes.includes(filter)) : courses
    return [...list]
      .sort((a, b) => haversine(origin, a.path[0]) - haversine(origin, b.path[0]))
      .slice(0, 15)
  }, [courses, filter, origin])

  const select = (id: string) => setSelectedId((prev) => (prev === id ? null : id))
  const toggleFilter = (p: PurposeId) => setFilter((prev) => (prev === p ? null : p))

  return (
    <div className="relative h-full w-full overflow-hidden">
      {status === 'ready' && (
        <TmapMap
          ref={mapHandle}
          className="absolute inset-0"
          courses={courses}
          filterPurpose={filter}
          selectedId={selectedId}
          userLocation={coords}
          onSelectCourse={select}
        />
      )}
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-fg-muted">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
          <p className="text-sm">TMAP 지도 불러오는 중…</p>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-8 text-center">
          <p className="font-extrabold">지도를 불러오지 못했어요</p>
          <p className="text-sm text-fg-muted">{error}</p>
        </div>
      )}

      {/* 지도/도감 토글 */}
      <ExploreToggle
        view={view}
        onChange={onView}
        className="absolute left-1/2 top-3 z-30 -translate-x-1/2"
      />

      {/* 검색 + 목적 칩 */}
      <div className="pointer-events-none absolute inset-x-0 top-16 z-20 space-y-2 p-3">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-surface/95 px-4 py-3 backdrop-blur shadow-[0_2px_10px_rgba(0,0,0,0.45)]">
          <Search size={18} className="text-fg-muted" />
          <span className="text-sm text-fg-muted">코스 · 지역 검색</span>
        </div>
        <div className="pointer-events-auto -mx-3 flex gap-2 overflow-x-auto px-3">
          {PURPOSES.map((p) => (
            <Chip key={p.id} selected={filter === p.id} onClick={() => toggleFilter(p.id)}>
              {p.emoji} {p.label}
            </Chip>
          ))}
        </div>
      </div>

      <MapWeatherWidget className="absolute left-3 top-[188px] z-10" />
      <MapControls
        className="absolute right-3 top-[188px] z-10"
        onZoomIn={() => mapHandle.current?.zoomIn()}
        onZoomOut={() => mapHandle.current?.zoomOut()}
        onLocate={request}
        locating={loading}
      />

      <NearbyPanel courses={nearby} selectedId={selectedId} onSelect={select} origin={origin} />
    </div>
  )
}

function NearbyPanel({
  courses,
  selectedId,
  onSelect,
  origin,
}: {
  courses: Course[]
  selectedId: string | null
  onSelect: (id: string) => void
  origin: { lat: number; lng: number }
}) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 rounded-t-[24px] bg-surface shadow-[0_-4px_24px_rgba(0,0,0,0.5)]">
      <div className="flex justify-center pt-2.5 pb-1">
        <div className="h-1.5 w-10 rounded-full bg-surface-2" />
      </div>
      <p className="px-4 pb-2 text-sm font-extrabold">
        지금 주변 코스 <span className="text-fg-muted">{courses.length}</span>
      </p>
      <div className="max-h-[200px] space-y-1 overflow-y-auto px-2 pb-3">
        {courses.map((c) => {
          const dist = haversine(origin, c.path[0])
          const active = c.id === selectedId
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors ${
                active ? 'bg-surface-2' : 'active:bg-surface-2'
              }`}
            >
              <img src={c.thumbnail} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-extrabold">{c.name}</p>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-fg-muted">
                  <span>{formatDistance(c.distanceKm)}</span>
                  <span>·</span>
                  <span>약 {c.estMinutes}분</span>
                  <span>·</span>
                  <DifficultyBadge level={c.difficulty} className="text-xs" />
                </div>
              </div>
              <span className="shrink-0 text-xs font-bold text-fg-muted">
                {dist < 1000 ? `${Math.round(dist)}m` : `${(dist / 1000).toFixed(1)}km`}
              </span>
            </button>
          )
        })}
        {courses.length === 0 && (
          <p className="px-2 py-8 text-center text-sm text-fg-muted">
            이 조건에 맞는 주변 코스가 없어요.
          </p>
        )}
      </div>
    </div>
  )
}
