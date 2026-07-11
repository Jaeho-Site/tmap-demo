import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, Flag, ThumbsUp, ThumbsDown, Sparkles, Plus, Heart, Route } from 'lucide-react'
import { getWalk, saveWalk } from '@/features/history/records'
import { useCustomRoutes } from '@/store/customRoutes'
import { recordProblemTags } from '@/features/feedback/quality'
import { POSITIVE_TAGS, PROBLEM_TAGS } from '@/features/feedback/tags'
import { buildRetrospective } from '@/features/retrospective/generate'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { Sheet } from '@/components/ui/Sheet'
import { formatDuration, formatMetersKm, estimateKcal } from '@/lib/format'
import type { WalkRecord } from '@/types/walk'

export function WalkCompletePage() {
  const { recordId } = useParams<{ recordId: string }>()
  const navigate = useNavigate()
  const base = useMemo(() => (recordId ? getWalk(recordId) : undefined), [recordId])

  const [rating, setRating] = useState<'up' | 'down' | null>(base?.rating ?? null)
  const [tags, setTags] = useState<string[]>(base?.tags ?? [])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [custom, setCustom] = useState('')
  const qualitySaved = useRef(false)

  const saveRoute = useCustomRoutes((s) => s.save)
  const removeRoute = useCustomRoutes((s) => s.remove)
  const savedRoutes = useCustomRoutes((s) => s.routes)

  const retro = useMemo(
    () => (base ? buildRetrospective({ ...base, rating: rating ?? undefined, tags }) : ''),
    [base, rating, tags],
  )

  // rating/tags/회고 변경을 기록에 반영(덮어쓰기 — 안전)
  useEffect(() => {
    if (!base) return
    const updated: WalkRecord = { ...base, rating: rating ?? undefined, tags, retrospective: retro }
    saveWalk(updated)
  }, [base, rating, tags, retro])

  if (!base) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-bg px-8 text-center">
        <p className="font-extrabold">산책 기록을 찾을 수 없어요</p>
        <Button onClick={() => navigate('/')}>홈으로</Button>
      </div>
    )
  }
  const record = base

  // 커스텀 산책(자유/AI)만 경로 저장 가능 — 카탈로그 코스는 이미 코스로 존재
  const isCustomWalk =
    record.courseId.startsWith('free-') || record.courseId.startsWith('ai-')
  const canSaveRoute = isCustomWalk && record.track.length >= 2
  const routeSaved = savedRoutes.some((r) => r.id === record.courseId)
  const toggleSaveRoute = () => {
    if (routeSaved) {
      removeRoute(record.courseId)
      return
    }
    saveRoute({
      id: record.courseId,
      name: record.courseName,
      kind: record.courseId.startsWith('ai-') ? 'ai' : 'free',
      distanceKm: Math.round(record.distanceM / 100) / 10,
      estMinutes: Math.max(1, Math.round(record.durationSec / 60)),
      path: record.track,
      trip: 'oneway',
      shareStatus: 'private',
      createdAt: Date.now(),
    })
  }

  const chooseRating = (r: 'up' | 'down') => {
    setRating(r)
    setSheetOpen(true)
  }
  const toggleTag = (label: string) =>
    setTags((t) => (t.includes(label) ? t.filter((x) => x !== label) : [...t, label]))
  const addCustom = () => {
    const c = custom.trim()
    if (c && !tags.includes(c)) setTags((t) => [...t, c])
    setCustom('')
  }
  const finish = (dest: string) => {
    if (!qualitySaved.current) {
      recordProblemTags(record.courseId, tags) // 문제 태그 → 코스 품질(E7)
      qualitySaved.current = true
    }
    navigate(dest)
  }

  const tagOptions = rating === 'down' ? PROBLEM_TAGS : POSITIVE_TAGS

  return (
    <div className="flex min-h-screen flex-col bg-bg px-4 pb-8 pt-10">
      <div className="flex flex-col items-center gap-2 text-center">
        {record.completed ? (
          <CheckCircle2 size={56} className="text-primary" />
        ) : (
          <Flag size={56} className="text-fg-muted" />
        )}
        <h1 className="text-2xl font-extrabold">{record.completed ? '산책 완주!' : '산책 종료'}</h1>
        <p className="text-[15px] text-fg-muted">{record.courseName}</p>
      </div>

      <Card className="mt-6">
        <div className="grid grid-cols-3 divide-x divide-border">
          <Stat label="거리" value={formatMetersKm(record.distanceM)} />
          <Stat label="시간" value={formatDuration(record.durationSec)} />
          <Stat label="칼로리" value={`${estimateKcal(record.distanceM)}`} />
        </div>
      </Card>

      {/* 원탭 평가 (US-4.1) */}
      <Card className="mt-4">
        <div className="p-4">
          {rating === null ? (
            <>
              <p className="mb-3 text-center font-extrabold">이 산책, 어떠셨어요?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => chooseRating('up')}
                  className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl bg-surface-2 py-4 active:scale-95 transition-transform"
                >
                  <ThumbsUp size={26} className="text-primary" />
                  <span className="text-sm font-bold">좋았어요</span>
                </button>
                <button
                  onClick={() => chooseRating('down')}
                  className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl bg-surface-2 py-4 active:scale-95 transition-transform"
                >
                  <ThumbsDown size={26} className="text-fg-muted" />
                  <span className="text-sm font-bold">아쉬웠어요</span>
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              {rating === 'up' ? (
                <ThumbsUp size={22} className="text-primary" />
              ) : (
                <ThumbsDown size={22} className="text-fg-muted" />
              )}
              <div className="flex flex-1 flex-wrap items-center gap-1.5">
                {tags.length ? (
                  tags.map((t) => (
                    <span key={t} className="rounded-full bg-surface-2 px-3 py-1 text-xs font-bold">
                      {t}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-fg-muted">평가 완료</span>
                )}
              </div>
              <button
                onClick={() => setSheetOpen(true)}
                className="shrink-0 text-sm font-bold text-primary"
              >
                태그 수정
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* AI 회고 (E1) */}
      <Card className="mt-4">
        <div className="p-4">
          <div className="mb-2 flex items-center gap-1.5">
            <Sparkles size={16} className="text-primary" />
            <span className="text-sm font-extrabold">AI 회고</span>
          </div>
          <p className="text-[15px] leading-relaxed">{retro}</p>
        </div>
      </Card>

      {/* 커스텀 경로 저장 (자유 산책 · AI 경로) */}
      {canSaveRoute && (
        <Card className="mt-4">
          <button onClick={toggleSaveRoute} className="flex w-full items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-primary">
              <Route size={20} />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="font-extrabold">{routeSaved ? '저장한 경로' : '이 경로 저장하기'}</p>
              <p className="mt-0.5 text-xs text-fg-muted">
                {routeSaved ? '저장 탭에서 다시 걸을 수 있어요' : '방금 걸은 길을 내 경로로 보관해요'}
              </p>
            </div>
            <Heart
              size={22}
              className={routeSaved ? 'shrink-0 fill-primary text-primary' : 'shrink-0 text-fg-muted'}
            />
          </button>
        </Card>
      )}

      {record.notes.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-extrabold">산책 중 메모</p>
          <div className="flex flex-wrap gap-1.5">
            {record.notes.map((n, i) => (
              <span key={i} className="rounded-full bg-surface px-3 py-1.5 text-sm">
                📝 {n}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto flex gap-2 pt-6">
        <Button variant="surface" size="lg" className="flex-1" onClick={() => finish('/history')}>
          기록 보기
        </Button>
        <Button size="lg" className="flex-1" onClick={() => finish('/')}>
          완료
        </Button>
      </div>

      {/* 태그 시트 (US-4.2) */}
      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={rating === 'down' ? '무엇이 아쉬웠나요?' : '무엇이 좋았나요?'}
      >
        <p className="mb-4 text-sm text-fg-muted">태그는 선택 사항이에요. 건너뛰어도 평가는 기록돼요.</p>
        <div className="flex flex-wrap gap-2">
          {tagOptions.map((t) => (
            <Chip key={t.id} selected={tags.includes(t.label)} onClick={() => toggleTag(t.label)}>
              {t.emoji} {t.label}
            </Chip>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCustom()}
            placeholder="직접 입력"
            className="h-11 flex-1 rounded-full bg-surface-2 px-4 text-sm outline-none placeholder:text-fg-muted"
          />
          <button
            onClick={addCustom}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2"
            aria-label="태그 추가"
          >
            <Plus size={20} />
          </button>
        </div>
        <Button size="lg" className="mt-6 w-full" onClick={() => setSheetOpen(false)}>
          완료
        </Button>
      </Sheet>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 py-4">
      <span className="text-xl font-extrabold tabular-nums">{value}</span>
      <span className="text-xs text-fg-muted">{label}</span>
    </div>
  )
}
