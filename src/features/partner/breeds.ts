import type { Rarity } from './gacha'

/** 강아지 도감 마스터. 이미지 에셋 대신 이모지+희귀도 색 플레이스홀더. */
export interface DogBreed {
  id: string
  name: string
  rarity: Rarity
  emoji: string
  desc: string
}

export const BREEDS: DogBreed[] = [
  // D · 일반
  { id: 'mix', name: '동네 믹스', rarity: 'D', emoji: '🐕', desc: '골목을 제일 잘 아는 든든한 친구.' },
  { id: 'jindo-pup', name: '골목대장 강아지', rarity: 'D', emoji: '🐶', desc: '어디든 앞장서는 산책 메이트.' },
  // C · 고급
  { id: 'shiba', name: '시바', rarity: 'C', emoji: '🦮', desc: '표정 부자. 걸음이 경쾌해요.' },
  { id: 'jindo', name: '진돗개', rarity: 'C', emoji: '🐕‍🦺', desc: '충직한 대전 토박이 견종.' },
  // B · 희귀
  { id: 'corgi', name: '웰시코기', rarity: 'B', emoji: '🐕', desc: '짧은 다리로 부지런히 따라와요.' },
  { id: 'poodle', name: '푸들', rarity: 'B', emoji: '🐩', desc: '곱슬곱슬, 산책 후 인증샷 담당.' },
  // A · 영웅
  { id: 'golden', name: '골든리트리버', rarity: 'A', emoji: '🦴', desc: '햇살 같은 성격의 명품 산책러.' },
  { id: 'husky', name: '허스키', rarity: 'A', emoji: '🐺', desc: '체력 만렙. 장거리 코스에 강해요.' },
  // S · 전설
  { id: 'samoyed', name: '사모예드', rarity: 'S', emoji: '☁️', desc: '구름을 닮은 미소 천사. 아주 드물어요.' },
  { id: 'secret-fox', name: '시크릿 여우견', rarity: 'S', emoji: '🦊', desc: '전설로만 전해지던 산책의 요정.' },
]

export const BREED_MAP: Record<string, DogBreed> = Object.fromEntries(
  BREEDS.map((b) => [b.id, b]),
)

/** 희귀도별 견종 후보. */
export function breedsOfRarity(rarity: Rarity): DogBreed[] {
  return BREEDS.filter((b) => b.rarity === rarity)
}

/** 희귀도에서 견종 하나를 무작위로. */
export function pickBreed(rarity: Rarity, rnd: () => number = Math.random): DogBreed {
  const pool = breedsOfRarity(rarity)
  return pool[Math.floor(rnd() * pool.length)] ?? BREEDS[0]
}
