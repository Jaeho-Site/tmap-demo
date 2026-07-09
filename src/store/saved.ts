import { create } from 'zustand'

// 저장 코스 (US-6.4, 투자 누적). 프로토타입: localStorage.
const KEY = 'sanchaek.saved'

function load(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

interface SavedState {
  ids: string[]
  toggle: (id: string) => void
  has: (id: string) => boolean
}

export const useSaved = create<SavedState>((set, get) => ({
  ids: load(),
  toggle: (id) =>
    set((s) => {
      const ids = s.ids.includes(id) ? s.ids.filter((x) => x !== id) : [...s.ids, id]
      try {
        localStorage.setItem(KEY, JSON.stringify(ids))
      } catch {
        /* 무시 */
      }
      return { ids }
    }),
  has: (id) => get().ids.includes(id),
}))
