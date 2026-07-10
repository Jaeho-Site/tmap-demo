import { create } from 'zustand'
import type { PurposeId } from '@/data/daejeonData'
import type { Difficulty } from '@/types/course'

export interface Conditions {
  /** 가용 시간(분). null = 무입력(합리적 기본값). */
  minutes: number | null
  difficulty: Difficulty | null
  purposes: PurposeId[]
}

interface ConditionsState extends Conditions {
  setMinutes: (m: number | null) => void
  setDifficulty: (d: Difficulty | null) => void
  togglePurpose: (p: PurposeId) => void
  reset: () => void
}

// 조건은 전 화면(홈·조건시트·탐험) 공유. "거의 무입력" 기본값(UX P1).
export const useConditions = create<ConditionsState>((set) => ({
  minutes: null,
  difficulty: null,
  purposes: [],
  setMinutes: (minutes) => set((s) => ({ minutes: s.minutes === minutes ? null : minutes })),
  setDifficulty: (difficulty) => set((s) => ({ difficulty: s.difficulty === difficulty ? null : difficulty })),
  togglePurpose: (p) =>
    set((s) => ({
      purposes: s.purposes.includes(p) ? s.purposes.filter((x) => x !== p) : [...s.purposes, p],
    })),
  reset: () => set({ minutes: null, difficulty: null, purposes: [] }),
}))
