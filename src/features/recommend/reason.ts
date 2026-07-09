import type { Course, Difficulty } from '@/types/course'
import type { Conditions } from '@/store/conditions'
import type { PurposeId } from '@/data/daejeonData'

// 실제 코스 속성에만 근거한 이유 문구(지어내기 금지, UX P3).
const PURPOSE_PHRASE: Record<PurposeId, string> = {
  nature: '녹지와 나무 그늘이 이어지는',
  safety: '조명과 CCTV가 많아 안전한',
  joint: '보차분리로 평탄한',
  quiet: '비교적 조용한',
}

const DIFF_PHRASE: Record<Difficulty, string> = {
  easy: '대체로 평지라 가볍게 걷기 좋아요',
  moderate: '완만한 오르내림이 있어 적당히 운동돼요',
  hard: '경사가 있는 편이라 조금 땀이 나요',
}

const THIN_LABEL: Partial<Record<PurposeId, string>> = {
  quiet: '조용한지',
  joint: '관절에 편한지',
}

/**
 * 코스의 실제 속성 + 사용자가 고른 목적을 반영한 자연어 이유.
 * 데이터가 얇은 목적은 정직하게 유의점을 덧붙인다(UX P7).
 */
export function buildReason(course: Course, cond: Conditions): string {
  const primary = cond.purposes.find((p) => course.purposes.includes(p)) ?? course.purposes[0]
  const lead = `${course.area}의 ${PURPOSE_PHRASE[primary]} 길이에요.`
  const body = `${course.distanceKm}km · 약 ${course.estMinutes}분, ${DIFF_PHRASE[course.difficulty]}`

  const thin = cond.purposes.find(
    (p) => THIN_LABEL[p] && course.confidence[p] !== 'verified',
  )
  const note = thin ? ` 다만 이 길이 얼마나 ${THIN_LABEL[thin]}는 아직 덜 확실해요.` : ''

  return `${lead} ${body}.${note}`
}
