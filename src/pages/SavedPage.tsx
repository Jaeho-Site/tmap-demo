import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { useSaved } from '@/store/saved'
import { getCourseMap } from '@/features/recommend/courses'
import { DifficultyBadge } from '@/components/ui/Badge'
import { formatDistance } from '@/lib/geo'

export function SavedPage() {
  const navigate = useNavigate()
  const ids = useSaved((s) => s.ids)
  const courseMap = useMemo(() => getCourseMap(), [])
  const saved = useMemo(
    () => ids.map((id) => courseMap.get(id)).filter((c): c is NonNullable<typeof c> => !!c),
    [ids, courseMap],
  )

  return (
    <div>
      <header className="px-4 pt-5 pb-3">
        <h1 className="text-2xl font-extrabold">저장</h1>
      </header>

      {saved.length === 0 ? (
        <div className="flex flex-col items-center gap-4 px-8 pt-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface">
            <Heart size={28} className="text-fg-muted" />
          </div>
          <h2 className="text-xl font-extrabold">저장한 코스가 없어요</h2>
          <p className="text-[15px] leading-relaxed text-fg-muted">
            코스 상세에서 하트를 누르면
            <br />
            여기에 모여요. 좋아하는 길을 다시 걸어요.
          </p>
        </div>
      ) : (
        <div className="space-y-2 px-4">
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
        </div>
      )}
    </div>
  )
}
