// 각 가로수길의 시작→종료 구간을 TMAP 보행자 경로안내 API로 계산해
// src/data/streetRoutes.ts 로 굽는다. (런타임 314회 호출 회피 + rate limit 대응)
// 캐시(scripts/.route-cache.json)에 저장하므로 재실행 시 성공분은 건너뛴다.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const STREETS_TS = join(__dirname, '..', 'src', 'data', 'streets.ts')
const OUT = join(__dirname, '..', 'src', 'data', 'streetRoutes.ts')
const CACHE = join(__dirname, '.route-cache.json')

const APP_KEY = 'QrqfJJm26I5kWsKHlI4mA7IX77yOQJ8FasRSmVCL'
const ENDPOINT = 'https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json'
const DELAY_MS = 130 // 호출 간 간격 (rate limit 여유)

// streets.ts 에서 STREETS 배열만 뽑아 파싱
function loadStreets() {
  const text = readFileSync(STREETS_TS, 'utf8')
  const marker = 'export const STREETS: Street[] = '
  const at = text.indexOf(marker)
  if (at < 0) throw new Error('STREETS 배열을 찾지 못함')
  const json = text.slice(at + marker.length).trim().replace(/;?\s*$/, '')
  return JSON.parse(json)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchRoute(s) {
  const body = {
    startX: String(s.startLng), startY: String(s.startLat),
    endX: String(s.endLng), endY: String(s.endLat),
    startName: '출발', endName: '도착',
    reqCoordType: 'WGS84GEO', resCoordType: 'WGS84GEO', searchOption: '0',
  }
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { appKey: APP_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const j = await res.json()
  if (!j.features) throw new Error('features 없음: ' + JSON.stringify(j).slice(0, 120))

  // LineString 좌표를 순서대로 이어 [lat,lng] 경로로. 총거리/시간은 첫 Point에서.
  const path = []
  let distance = null
  let time = null
  for (const f of j.features) {
    const p = f.properties || {}
    if (distance == null && p.totalDistance != null) { distance = p.totalDistance; time = p.totalTime }
    if (f.geometry?.type === 'LineString') {
      for (const [lng, lat] of f.geometry.coordinates) {
        const last = path[path.length - 1]
        if (!last || last[0] !== lat || last[1] !== lng) path.push([Number(lat.toFixed(6)), Number(lng.toFixed(6))])
      }
    }
  }
  if (path.length < 2) throw new Error('경로 좌표 부족')
  return { path, distance, time }
}

async function main() {
  const streets = loadStreets()
  const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {}
  let ok = 0, fail = 0, cached = 0
  const failures = []

  for (let i = 0; i < streets.length; i++) {
    const s = streets[i]
    if (cache[s.id]?.path?.length >= 2) { cached++; continue }
    try {
      cache[s.id] = await fetchRoute(s)
      ok++
    } catch (e) {
      fail++
      failures.push(`${s.id} ${s.name}: ${e.message}`)
    }
    if ((i + 1) % 25 === 0 || i === streets.length - 1) {
      writeFileSync(CACHE, JSON.stringify(cache), 'utf8')
      process.stdout.write(`\r진행 ${i + 1}/${streets.length} · 신규성공 ${ok} 캐시 ${cached} 실패 ${fail}   `)
    }
    await sleep(DELAY_MS)
  }
  console.log()

  // 캐시 → streetRoutes.ts 출력 (성공한 경로만)
  const routes = {}
  for (const s of streets) if (cache[s.id]?.path?.length >= 2) routes[s.id] = cache[s.id]

  const banner = `// 자동 생성 파일 — 수정 금지. 재생성: node scripts/fetchStreetRoutes.mjs
// 각 가로수길 시작→종료를 TMAP 보행자 경로안내 API로 계산한 실제 보행 경로.
// 경로 있는 가로수길: ${Object.keys(routes).length} / ${streets.length}
`
  const ts = `${banner}
export interface StreetRoute {
  path: [number, number][] // [lat, lng] 순서
  distance: number | null  // 보행 거리(m)
  time: number | null      // 보행 시간(s)
}

export const STREET_ROUTES: Record<string, StreetRoute> = ${JSON.stringify(routes, null, 0)}
`
  writeFileSync(OUT, ts, 'utf8')
  console.log(`생성 완료: ${OUT}`)
  console.log(`경로 확보 ${Object.keys(routes).length} / ${streets.length}`)
  if (failures.length) {
    console.log(`실패 ${failures.length}건:`)
    failures.slice(0, 15).forEach((f) => console.log('  -', f))
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
