// data/*.csv (대전 5개 구 도시공원정보) → src/data/parks.ts 생성
// 위도/경도가 유효한 모든 행을 노드로 만들고 이름·구분·시설 기반 태그를 부여한다.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data')
const OUT = join(__dirname, '..', 'src', 'data', 'parks.ts')

// 따옴표(내부 쉼표 포함)를 처리하는 최소 CSV 파서
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += c
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

function districtFromName(fname) {
  const m = fname.match(/대전광역시_(.+?)_도시공원정보/)
  return m ? m[1] : ''
}

const files = readdirSync(DATA_DIR).filter((f) => f.toLowerCase().endsWith('.csv'))
const parks = []
const catCount = {}
let skipped = 0

for (const file of files) {
  const district = districtFromName(file)
  let text = readFileSync(join(DATA_DIR, file), 'utf8')
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1) // BOM 제거
  const rows = parseCsv(text)
  const header = rows[0].map((h) => h.trim())
  const idx = (name) => header.indexOf(name)
  const iId = idx('관리번호')
  const iName = idx('공원명')
  const iCat = idx('공원구분')
  const iRoad = idx('소재지도로명주소')
  const iJibun = idx('소재지지번주소')
  const iLat = idx('위도')
  const iLng = idx('경도')
  const iArea = idx('공원면적')
  const iSport = idx('공원보유시설(운동시설)')
  const iPlay = idx('공원보유시설(유희시설)')
  const iConv = idx('공원보유시설(편익시설)')
  const iCult = idx('공원보유시설(교양시설)')

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    if (!row || row.length < header.length - 2) continue
    const lat = parseFloat(row[iLat])
    const lng = parseFloat(row[iLng])
    // 대전 대략 범위 안의 유효 좌표만 노드로
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 35.9 || lat > 36.6 || lng < 127.1 || lng > 127.7) {
      skipped++
      continue
    }
    const name = (row[iName] || '').trim()
    const category = (row[iCat] || '').trim() || '공원'
    catCount[category] = (catCount[category] || 0) + 1

    const has = (i) => i >= 0 && (row[i] || '').trim().length > 0
    const tags = [category]
    if (has(iSport)) tags.push('운동시설')
    if (has(iPlay)) tags.push('놀이시설')
    if (has(iConv)) tags.push('편의시설')
    if (has(iCult)) tags.push('교양시설')
    const convText = (row[iConv] || '')
    if (convText.includes('화장실')) tags.push('화장실')

    const area = parseFloat((row[iArea] || '').replace(/[^0-9.]/g, ''))

    parks.push({
      id: (row[iId] || `${district}-${r}`).trim(),
      name: name || '(이름없음)',
      category,
      district,
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      area: Number.isFinite(area) ? area : null,
      address: ((row[iRoad] || '').trim() || (row[iJibun] || '').trim()),
      tags,
    })
  }
}

const banner = `// 자동 생성 파일 — 수정 금지. 재생성: node scripts/generateParks.mjs
// 출처: map-test/data/대전광역시_*_도시공원정보_*.csv (대전 5개 구 공공데이터)
// 노드 수: ${parks.length} · 제외(좌표 무효): ${skipped}
`

const ts = `${banner}
export interface Park {
  id: string
  name: string
  category: string
  district: string
  lat: number
  lng: number
  area: number | null
  address: string
  tags: string[]
}

export const PARK_CATEGORIES = ${JSON.stringify(Object.keys(catCount).sort((a, b) => catCount[b] - catCount[a]))} as const

export const PARKS: Park[] = ${JSON.stringify(parks, null, 0)}
`

writeFileSync(OUT, ts, 'utf8')
console.log(`생성 완료: ${OUT}`)
console.log(`노드 ${parks.length}개 (좌표 무효 제외 ${skipped}개)`)
console.log('공원구분 분포:', catCount)
