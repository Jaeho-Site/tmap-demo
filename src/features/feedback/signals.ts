// 암묵적 피드백 수집(사용자 노력 제로, US-4.4). Phase 4에서 확장.
// 프로토타입은 localStorage에 append (백엔드 이전 시 인터페이스 유지).
export type SignalType = 'view' | 'skip' | 'start' | 'complete' | 'abandon'

const KEY = 'sanchaek.signals'

export function recordSignal(type: SignalType, courseId: string): void {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown[]
    arr.push({ type, courseId, t: Date.now() })
    localStorage.setItem(KEY, JSON.stringify(arr.slice(-200)))
  } catch {
    /* 저장 실패는 무시 */
  }
}
