import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Difficulty = 'easy' | 'moderate' | 'hard'
type Confidence = 'verified' | 'estimated' | 'low'

const DIFF_LABEL: Record<Difficulty, string> = { easy: '쉬움', moderate: '보통', hard: '어려움' }
const DIFF_COLOR: Record<Difficulty, string> = {
  easy: 'text-diff-easy',
  moderate: 'text-diff-moderate',
  hard: 'text-diff-hard',
}
const DIFF_DOT: Record<Difficulty, string> = {
  easy: 'bg-diff-easy',
  moderate: 'bg-diff-moderate',
  hard: 'bg-diff-hard',
}

/** 난이도 배지 — 색 + 라벨(색 비의존, UX 접근성). */
export function DifficultyBadge({ level, className }: { level: Difficulty; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm font-bold', DIFF_COLOR[level], className)}>
      <i className={cn('h-2 w-2 rounded-full', DIFF_DOT[level])} />
      {DIFF_LABEL[level]}
    </span>
  )
}

const CONF: Record<Confidence, { label: string; cls: string }> = {
  verified: { label: '검증됨', cls: 'bg-primary/15 text-primary' },
  estimated: { label: '추정', cls: 'bg-surface-2 text-fg-muted' },
  low: { label: '신뢰도 낮음', cls: 'bg-danger/15 text-danger' },
}

/** 신뢰도 배지 — 얇은 데이터 목적에 정직 표시(UX P7). */
export function ConfidenceBadge({ level, className }: { level: Confidence; className?: string }) {
  const c = CONF[level]
  return (
    <span
      className={cn(
        'inline-flex items-center h-6 px-2.5 rounded-full text-xs font-bold',
        c.cls,
        className,
      )}
    >
      {c.label}
    </span>
  )
}

/** 범용 라벨 배지. */
export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center h-6 px-2.5 rounded-full text-xs font-bold bg-surface-2 text-fg',
        className,
      )}
      {...props}
    />
  )
}
