import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flame, ThumbsUp, ThumbsDown, CheckCircle2, Flag } from 'lucide-react'
import { listWalks } from '@/features/history/records'
import { computeStats } from '@/features/history/stats'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { formatDuration, formatMetersKm, formatWalkDate } from '@/lib/format'

export function HistoryPage() {
  const navigate = useNavigate()
  const walks = useMemo(() => listWalks(), [])
  const stats = useMemo(() => computeStats(walks), [walks])

  if (walks.length === 0) {
    return (
      <div>
        <header className="px-4 pt-5 pb-3">
          <h1 className="text-2xl font-extrabold">기록</h1>
        </header>
        <div className="flex flex-col items-center gap-4 px-8 pt-16 text-center">
          <img src="/images/r1.jpg" alt="" className="h-40 w-40 rounded-[20px] object-cover" />
          <h2 className="text-xl font-extrabold">첫 산책을 시작해요</h2>
          <p className="text-[15px] leading-relaxed text-fg-muted">
            산책을 마치면 경로·거리·시간이 자동으로 기록되고
            <br />
            연속 기록과 월간 리포트가 쌓입니다.
          </p>
          <Button size="lg" onClick={() => navigate('/')}>
            추천 코스 보기
          </Button>
        </div>
      </div>
    )
  }

  const month = new Date().getMonth() + 1

  return (
    <div className="px-4 pt-5 pb-8">
      <h1 className="text-2xl font-extrabold">기록</h1>

      {/* 연속 기록 배너 */}
      {stats.dayStreak > 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-[20px] bg-primary/15 p-4">
          <Flame size={28} className="text-primary" />
          <div>
            <p className="font-extrabold">{stats.dayStreak}일 연속 산책 중!</p>
            <p className="text-sm text-fg-muted">이 흐름을 이어가 보세요</p>
          </div>
        </div>
      )}

      {/* 월간 리포트 */}
      <Card className="mt-4">
        <div className="p-4">
          <p className="text-sm font-bold text-fg-muted">{month}월 리포트</p>
          <div className="mt-2 grid grid-cols-3 divide-x divide-border">
            <Stat value={formatMetersKm(stats.monthDistanceM)} label="이번 달 거리" />
            <Stat value={`${stats.monthWalks}회`} label="이번 달 산책" />
            <Stat value={`${stats.totalWalks}회`} label="누적 산책" />
          </div>
        </div>
      </Card>

      {/* 산책 리스트 */}
      <p className="mt-6 mb-2 text-sm font-bold text-fg-muted">산책 기록</p>
      <div className="space-y-2">
        {walks.map((w) => (
          <button
            key={w.id}
            onClick={() => navigate(`/complete/${w.id}`)}
            className="flex w-full items-center gap-3 rounded-2xl bg-surface p-3 text-left active:brightness-110"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2">
              {w.completed ? (
                <CheckCircle2 size={22} className="text-primary" />
              ) : (
                <Flag size={20} className="text-fg-muted" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-extrabold">{w.courseName}</p>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-fg-muted">
                <span>{formatWalkDate(w.endedAt)}</span>
                <span>·</span>
                <span>{formatMetersKm(w.distanceM)}</span>
                <span>·</span>
                <span>{formatDuration(w.durationSec)}</span>
              </div>
            </div>
            {w.rating === 'up' && <ThumbsUp size={18} className="shrink-0 text-primary" />}
            {w.rating === 'down' && <ThumbsDown size={18} className="shrink-0 text-fg-muted" />}
          </button>
        ))}
      </div>
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 py-2">
      <span className="text-lg font-extrabold tabular-nums">{value}</span>
      <span className="text-[11px] text-fg-muted">{label}</span>
    </div>
  )
}
