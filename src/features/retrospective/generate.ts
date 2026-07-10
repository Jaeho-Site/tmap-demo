import type { WalkRecord } from '@/types/walk'
import { formatDuration, formatMetersKm } from '@/lib/format'

// 목업 AI 회고 (E1). 실제 기록·메모·피드백에만 근거 — 지어낸 사건 없음(UX P6).
// Phase 7에서 LLM 호출로 대체(인터페이스 동일: WalkRecord → string).

function timeWord(ts: number): string {
  const h = new Date(ts).getHours()
  if (h < 6) return '새벽'
  if (h < 11) return '아침'
  if (h < 14) return '한낮'
  if (h < 18) return '오후'
  if (h < 21) return '저녁'
  return '밤'
}

export function buildRetrospective(r: WalkRecord): string {
  const lines: string[] = []
  lines.push(`${timeWord(r.endedAt)}의 ${r.area} 산책, 수고하셨어요.`)
  lines.push(
    `${formatMetersKm(r.distanceM)}를 ${formatDuration(r.durationSec)} 동안 걸었어요.` +
      (r.completed
        ? ' 코스를 끝까지 완주했네요!'
        : ' 오늘은 여기까지 — 걸음을 낸 것만으로 충분해요.'),
  )
  if (r.notes.length) {
    lines.push(`걷는 동안 “${r.notes[0]}”라고 남기셨죠. 그 순간이 오늘 산책을 조금 더 특별하게 만들어요.`)
  }
  if (r.rating === 'up') {
    lines.push('마음에 든 길이었다니 다행이에요. 다음에도 이런 결을 더 찾아볼게요.')
  } else if (r.rating === 'down') {
    lines.push('아쉬운 점은 잘 기록해뒀어요. 다음 추천은 오늘 피드백을 반영할게요.')
  }
  lines.push('내일도 이 가벼운 걸음이 이어지길 바라요.')
  return lines.join(' ')
}
