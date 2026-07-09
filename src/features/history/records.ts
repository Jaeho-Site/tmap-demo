import type { WalkRecord } from '@/types/walk'

// 산책 기록 저장소 (프로토타입: localStorage. 백엔드 이전 시 인터페이스 유지).
const KEY = 'sanchaek.walks'

function readAll(): WalkRecord[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as WalkRecord[]
  } catch {
    return []
  }
}

function writeAll(list: WalkRecord[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-100)))
  } catch {
    /* 저장 실패 무시 */
  }
}

export function saveWalk(record: WalkRecord): void {
  const list = readAll()
  const i = list.findIndex((r) => r.id === record.id)
  if (i >= 0) list[i] = record
  else list.push(record)
  writeAll(list)
}

/** 최신순 산책 기록. */
export function listWalks(): WalkRecord[] {
  return readAll().sort((a, b) => b.endedAt - a.endedAt)
}

export function getWalk(id: string): WalkRecord | undefined {
  return readAll().find((r) => r.id === id)
}
