// data/가로수길/*.csv (대전 4개 구 가로수길정보) → src/data/streets.ts 생성
// 각 가로수길 = 노드 1개. 시작(위경도)→종료(위경도)를 연결선(path)으로 표현.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data', '가로수길')
const OUT = join(__dirname, '..', 'src', 'data', 'streets.ts')

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
  const m = fname.match(/대전광역시_(.+?)_가로수길정보/)
  return m ? m[1] : ''
}

const inDaejeon = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) &&
  lat >= 35.9 && lat <= 36.6 && lng >= 127.1 && lng <= 127.7

const files = readdirSync(DATA_DIR).filter((f) => f.toLowerCase().endsWith('.csv'))
const streets = []
let skipped = 0

for (const file of files) {
  const district = districtFromName(file)
  let text = readFileSync(join(DATA_DIR, file), 'utf8')
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  const rows = parseCsv(text)
  const header = rows[0].map((h) => h.trim())
  const idx = (n) => header.indexOf(n)
  const iName = idx('가로수길명')
  const iSLat = idx('가로수길시작위도')
  const iSLng = idx('가로수길시작경도')
  const iELat = idx('가로수길종료위도')
  const iELng = idx('가로수길종료경도')
  const iTree = idx('가로수종류')
  const iQty = idx('가로수수량')
  const iLen = idx('가로수길길이')
  const iYear = idx('식재연도')
  const iIntro = idx('가로수길소개')
  const iSection = idx('도로구간')

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    if (!row || row.length < 5) continue
    const sLat = parseFloat(row[iSLat]); const sLng = parseFloat(row[iSLng])
    const eLat = parseFloat(row[iELat]); const eLng = parseFloat(row[iELng])
    if (!inDaejeon(sLat, sLng) || !inDaejeon(eLat, eLng)) { skipped++; continue }

    const treeType = (row[iTree] || '').trim()
    const tags = ['가로수길', ...treeType.split(/[+/,]/).map((s) => s.trim()).filter(Boolean)]
    const qty = parseInt((row[iQty] || '').replace(/[^0-9]/g, ''), 10)
    const length = parseFloat((row[iLen] || '').replace(/[^0-9.]/g, ''))
    const year = parseInt((row[iYear] || '').replace(/[^0-9]/g, ''), 10)

    streets.push({
      id: `${district}-${r}`,
      name: (row[iName] || '(이름없음)').trim(),
      district,
      startLat: Number(sLat.toFixed(6)),
      startLng: Number(sLng.toFixed(6)),
      endLat: Number(eLat.toFixed(6)),
      endLng: Number(eLng.toFixed(6)),
      midLat: Number(((sLat + eLat) / 2).toFixed(6)),
      midLng: Number(((sLng + eLng) / 2).toFixed(6)),
      treeType: treeType || '미상',
      count: Number.isFinite(qty) ? qty : null,
      length: Number.isFinite(length) ? length : null,
      plantYear: Number.isFinite(year) ? year : null,
      intro: (row[iIntro] || '').trim(),
      section: (row[iSection] || '').trim(),
      tags,
    })
  }
}

const banner = `// 자동 생성 파일 — 수정 금지. 재생성: node scripts/generateStreets.mjs
// 출처: map-test/data/가로수길/대전광역시_*_가로수길정보_*.csv
// 가로수길 노드 수: ${streets.length} · 제외(좌표 무효): ${skipped}
`

const ts = `${banner}
export interface Street {
  id: string
  name: string
  district: string
  startLat: number
  startLng: number
  endLat: number
  endLng: number
  midLat: number
  midLng: number
  treeType: string
  count: number | null
  length: number | null
  plantYear: number | null
  intro: string
  section: string
  tags: string[]
}

export const STREETS: Street[] = ${JSON.stringify(streets, null, 0)}
`

writeFileSync(OUT, ts, 'utf8')
console.log(`생성 완료: ${OUT}`)
console.log(`가로수길 노드 ${streets.length}개 (좌표 무효 제외 ${skipped}개)`)
