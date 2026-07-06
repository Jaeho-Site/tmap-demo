// data/보행전용도로/*.csv (대전 5개 구 전국보행자전용도로 표준데이터) → src/data/walkways.ts
// 각 보행자전용도로 = 시작·종료 노드. 시작==종료(점형)는 isPoint 표시.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data', '보행전용도로')
const OUT = join(__dirname, '..', 'src', 'data', 'walkways.ts')

function parseCsv(text) {
  const rows = []
  let row = [], field = '', inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false }
      else field += c
    } else {
      if (c === '"') inQuotes = true
      else if (c === ',') { row.push(field); field = '' }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else field += c
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  return rows
}

const inDaejeon = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) &&
  lat >= 35.9 && lat <= 36.6 && lng >= 127.1 && lng <= 127.7

const num = (v) => {
  const n = parseInt(String(v).replace(/[^0-9]/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}

const files = readdirSync(DATA_DIR).filter((f) => f.toLowerCase().endsWith('.csv'))
const walkways = []
let skipped = 0, points = 0

for (const file of files) {
  let text = readFileSync(join(DATA_DIR, file), 'utf8')
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  const rows = parseCsv(text)
  const header = rows[0].map((h) => h.trim())
  const idx = (n) => header.indexOf(n)
  const iName = idx('보행자전용도로명')
  const iGu = idx('시군구명')
  const iDong = idx('법정동명')
  const iSLat = idx('보행자전용도로시작점위도')
  const iSLng = idx('보행자전용도로시작점경도')
  const iELat = idx('보행자전용도로종료점위도')
  const iELng = idx('보행자전용도로종료점경도')
  const iBike = idx('자전거보행자겸용도로구분')
  const iWidth = idx('보행자전용도로폭')
  const iSep = idx('보차분리여부')
  const iPurpose = idx('지정목적')
  const iCctv = idx('영상정보기처리기기설치개수')
  const iLamp = idx('보안등설치개수')
  const iCross = idx('횡단보도설치개수')
  const iBraille = idx('점자블럭설치개수')
  const iFence = idx('방호울타리설치개수')

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    if (!row || row.length < 14) continue
    const sLat = parseFloat(row[iSLat]), sLng = parseFloat(row[iSLng])
    const eLat = parseFloat(row[iELat]), eLng = parseFloat(row[iELng])
    if (!inDaejeon(sLat, sLng) || !inDaejeon(eLat, eLng)) { skipped++; continue }

    const isPoint = Math.abs(sLat - eLat) < 1e-5 && Math.abs(sLng - eLng) < 1e-5
    if (isPoint) points++

    const gu = (row[iGu] || '').trim()
    const separated = (row[iSep] || '').trim() === 'Y'
    const width = parseFloat((row[iWidth] || '').replace(/[^0-9.]/g, ''))
    const cctv = num(row[iCctv]), lamp = num(row[iLamp]), cross = num(row[iCross])
    const braille = num(row[iBraille]), fence = num(row[iFence])
    const bikeShared = (row[iBike] || '').trim()

    const tags = ['보행자전용도로']
    if (separated) tags.push('보차분리')
    if (cctv > 0) tags.push('CCTV')
    if (lamp > 0) tags.push('보안등')
    if (cross > 0) tags.push('횡단보도')
    if (braille > 0) tags.push('점자블록')
    if (fence > 0) tags.push('방호울타리')
    if (bikeShared.includes('겸용')) tags.push('자전거겸용')

    walkways.push({
      id: `${gu}-${r}`,
      name: (row[iName] || '(이름없음)').trim(),
      district: gu,
      dong: (row[iDong] || '').trim(),
      startLat: Number(sLat.toFixed(6)), startLng: Number(sLng.toFixed(6)),
      endLat: Number(eLat.toFixed(6)), endLng: Number(eLng.toFixed(6)),
      isPoint,
      width: Number.isFinite(width) ? width : null,
      separated,
      purpose: (row[iPurpose] || '').trim(),
      bikeShared,
      cctv, lamp, crosswalk: cross, braille, fence,
      tags,
    })
  }
}

const banner = `// 자동 생성 파일 — 수정 금지. 재생성: node scripts/generateWalkways.mjs
// 출처: map-test/data/보행전용도로/대전광역시_*_보행자전용도로_*.csv (전국보행자전용도로 표준데이터)
// 노드 수: ${walkways.length} · 점형(시작=종료) ${points} · 제외(좌표 무효) ${skipped}
`

const ts = `${banner}
export interface Walkway {
  id: string
  name: string
  district: string
  dong: string
  startLat: number
  startLng: number
  endLat: number
  endLng: number
  isPoint: boolean       // 시작=종료 (점형)
  width: number | null   // 보도폭(m)
  separated: boolean     // 보차분리 여부
  purpose: string
  bikeShared: string
  cctv: number
  lamp: number
  crosswalk: number
  braille: number
  fence: number
  tags: string[]
}

export const WALKWAYS: Walkway[] = ${JSON.stringify(walkways, null, 0)}
`

writeFileSync(OUT, ts, 'utf8')
console.log(`생성 완료: ${OUT}`)
console.log(`보행자전용도로 ${walkways.length}개 (점형 ${points} · 좌표 무효 제외 ${skipped})`)
