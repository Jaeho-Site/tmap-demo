import { create } from 'zustand'
import { drawRarity, type BoxKind, type Rarity } from '@/features/partner/gacha'
import { pickBreed } from '@/features/partner/breeds'

/** 보유 강아지 인스턴스(중복 획득도 각각 보관). */
export interface OwnedDog {
  uid: string
  breedId: string
  rarity: Rarity
  obtainedAt: number
  nickname?: string
}

interface PartnerData {
  boxes: { normal: number; guaranteed: number }
  dogs: OwnedDog[]
  activePartnerUid?: string
  pity: number
  /** 상자 보상을 이미 지급한 산책 기록 id(중복 지급 방지). */
  claimedWalkIds: string[]
}

const KEY = 'sanchaek.partner'

const EMPTY: PartnerData = {
  boxes: { normal: 0, guaranteed: 0 },
  dogs: [],
  pity: 0,
  claimedWalkIds: [],
}

function load(): PartnerData {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<PartnerData> | null
    if (!raw) return { ...EMPTY }
    return {
      boxes: { normal: raw.boxes?.normal ?? 0, guaranteed: raw.boxes?.guaranteed ?? 0 },
      dogs: raw.dogs ?? [],
      activePartnerUid: raw.activePartnerUid,
      pity: raw.pity ?? 0,
      claimedWalkIds: raw.claimedWalkIds ?? [],
    }
  } catch {
    return { ...EMPTY }
  }
}
function persist(d: PartnerData) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...d, claimedWalkIds: d.claimedWalkIds.slice(-100) }))
  } catch {
    /* 무시 */
  }
}

/** 산책 1건에 지급할 상자(완주 보상 규칙). */
export interface WalkReward {
  walkId: string
  distanceM: number
  dayStreak: number
}
function boxesForWalk(r: WalkReward): { normal: number; guaranteed: number } {
  // 완주 1회 = 일반 상자 1개. 장거리(5km+) 또는 연속 3의 배수일 = 확정 상자 1개.
  const guaranteed = r.distanceM >= 5000 || (r.dayStreak > 0 && r.dayStreak % 3 === 0) ? 1 : 0
  return { normal: 1, guaranteed }
}

export interface OpenResult {
  dog: OwnedDog
  rarity: Rarity
  byPity: boolean
}

interface PartnerStore extends PartnerData {
  /** 산책 완주 보상 지급(같은 walkId는 1회만). 지급된 상자 수를 반환. */
  grantForWalk: (r: WalkReward) => { normal: number; guaranteed: number } | null
  /** 상자 1개 개봉 → 강아지 획득. 상자가 없으면 null. */
  openBox: (kind: BoxKind) => OpenResult | null
  setActive: (uid: string) => void
  rename: (uid: string, nickname: string) => void
  /** 개발/데모용 상자 지급. */
  grantBox: (kind: BoxKind, n?: number) => void
}

let uidSeq = 0
const newUid = () => `dog-${Date.now().toString(36)}-${(uidSeq++).toString(36)}`

export const usePartner = create<PartnerStore>((set, get) => ({
  ...load(),
  grantForWalk: (r) => {
    const s = get()
    if (s.claimedWalkIds.includes(r.walkId)) return null
    const add = boxesForWalk(r)
    const next: PartnerData = {
      ...s,
      boxes: {
        normal: s.boxes.normal + add.normal,
        guaranteed: s.boxes.guaranteed + add.guaranteed,
      },
      claimedWalkIds: [...s.claimedWalkIds, r.walkId],
    }
    persist(next)
    set(next)
    return add
  },
  openBox: (kind) => {
    const s = get()
    if (s.boxes[kind] <= 0) return null
    const { rarity, nextPity, byPity } = drawRarity(kind, s.pity)
    const breed = pickBreed(rarity)
    const dog: OwnedDog = {
      uid: newUid(),
      breedId: breed.id,
      rarity,
      obtainedAt: Date.now(),
    }
    const next: PartnerData = {
      ...s,
      boxes: { ...s.boxes, [kind]: s.boxes[kind] - 1 },
      dogs: [dog, ...s.dogs],
      pity: nextPity,
      // 첫 강아지는 자동으로 대표 파트너
      activePartnerUid: s.activePartnerUid ?? dog.uid,
    }
    persist(next)
    set(next)
    return { dog, rarity, byPity }
  },
  setActive: (uid) =>
    set((s) => {
      const next = { ...s, activePartnerUid: uid }
      persist(next)
      return next
    }),
  rename: (uid, nickname) =>
    set((s) => {
      const dogs = s.dogs.map((d) => (d.uid === uid ? { ...d, nickname: nickname.trim() || undefined } : d))
      const next = { ...s, dogs }
      persist(next)
      return next
    }),
  grantBox: (kind, n = 1) =>
    set((s) => {
      const next = { ...s, boxes: { ...s.boxes, [kind]: s.boxes[kind] + n } }
      persist(next)
      return next
    }),
}))

/** 대표 파트너 견종/닉네임 조회(홈·프로필 노출용). */
export function activePartner(): OwnedDog | undefined {
  const s = usePartner.getState()
  return s.dogs.find((d) => d.uid === s.activePartnerUid)
}
