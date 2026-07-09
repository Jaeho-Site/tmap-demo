import { Sheet } from '@/components/ui/Sheet'
import { Chip } from '@/components/ui/Chip'
import { Button } from '@/components/ui/Button'
import { PURPOSES } from '@/data/daejeonData'
import { useConditions } from '@/store/conditions'
import type { Difficulty } from '@/types/course'

const MINUTES = [10, 20, 30, 40]
const DIFFS: { id: Difficulty; label: string }[] = [
  { id: 'easy', label: '쉬움' },
  { id: 'moderate', label: '보통' },
  { id: 'hard', label: '어려움' },
]

interface ConditionSheetProps {
  open: boolean
  onClose: () => void
}

/** 조건 시트 (US-1.3, 1.4) — 전부 선택 사항, 무입력도 추천 가능. */
export function ConditionSheet({ open, onClose }: ConditionSheetProps) {
  const { minutes, difficulty, purposes, setMinutes, setDifficulty, togglePurpose, reset } =
    useConditions()

  return (
    <Sheet open={open} onClose={onClose} title="어떤 산책을 원하세요?">
      <p className="mb-4 text-sm text-fg-muted">모두 선택 사항이에요. 그냥 추천만 받아도 좋아요.</p>

      <Section label="가용 시간">
        {MINUTES.map((m) => (
          <Chip key={m} selected={minutes === m} onClick={() => setMinutes(m)}>
            {m}분
          </Chip>
        ))}
      </Section>

      <Section label="난이도">
        {DIFFS.map((d) => (
          <Chip key={d.id} selected={difficulty === d.id} onClick={() => setDifficulty(d.id)}>
            {d.label}
          </Chip>
        ))}
      </Section>

      <Section label="산책 목적">
        {PURPOSES.map((p) => (
          <Chip key={p.id} selected={purposes.includes(p.id)} onClick={() => togglePurpose(p.id)}>
            {p.emoji} {p.label}
          </Chip>
        ))}
      </Section>

      <div className="mt-6 flex gap-2">
        <Button variant="surface" size="lg" onClick={reset}>
          초기화
        </Button>
        <Button size="lg" className="flex-1" onClick={onClose}>
          이 조건으로 추천
        </Button>
      </div>
    </Sheet>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="mb-2 text-sm font-extrabold">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}
