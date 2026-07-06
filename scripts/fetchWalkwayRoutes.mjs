// 보행자전용도로 시작→종료를 TMAP 보행자 경로안내 API로 계산 → src/data/walkwayRoutes.ts
// 점형(isPoint)은 건너뜀. 캐시(scripts/.walkway-route-cache.json)로 재실행 시 성공분 스킵.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC_TS = join(__dirname, '..', 'src', 'data', 'walkways.ts')
const OUT = join(__dirname, '..', 'src', 'data', 'walkwayRoutes.ts')
const CACHE = join(__dirname, '.walkway-route-cache.json')

// .env 의 VITE_TMAP_APP_KEY 를 로드 (커밋되지 않음, .env.example 참고)
process.loadEnvFile(join(__dirname, '..', '.env'))
const APP_KEY = process.env.VITE_TMAP_APP_KEY
if (!APP_KEY) throw new Error('VITE_TMAP_APP_KEY 가 .env 에 없습니다. .env.example 참고.')
const ENDPOINT = 'https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json'
const DELAY_MS = 130

function loadItems() {
  const text = readFileSync(SRC_TS, 'utf8')
  const marker = 'export const WALKWAYS: Walkway[] = '
  const at = text.indexOf(marker)
  if (at < 0) throw new Error('WALKWAYS 배열을 찾지 못함')
  return JSON.parse(text.slice(at + marker.length).trim().replace(/;?\s*$/, ''))
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
  if (!j.features) throw new Error('features 없음')
  const path = []
  let distance = null, time = null
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
  const items = loadItems().filter((s) => !s.isPoint)
  const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {}
  let ok = 0, fail = 0, cached = 0
  const failures = []

  for (let i = 0; i < items.length; i++) {
    const s = items[i]
    if (cache[s.id]?.path?.length >= 2) { cached++; continue }
    try { cache[s.id] = await fetchRoute(s); ok++ }
    catch (e) { fail++; failures.push(`${s.id} ${s.name}: ${e.message}`) }
    if ((i + 1) % 25 === 0 || i === items.length - 1) {
      writeFileSync(CACHE, JSON.stringify(cache), 'utf8')
      process.stdout.write(`\r진행 ${i + 1}/${items.length} · 성공 ${ok} 캐시 ${cached} 실패 ${fail}   `)
    }
    await sleep(DELAY_MS)
  }
  console.log()

  const routes = {}
  for (const s of items) if (cache[s.id]?.path?.length >= 2) routes[s.id] = cache[s.id]

  const banner = `// 자동 생성 파일 — 수정 금지. 재생성: node scripts/fetchWalkwayRoutes.mjs
// 보행자전용도로 시작→종료를 TMAP 보행자 경로안내 API로 계산한 실제 보행 경로.
// 경로 확보: ${Object.keys(routes).length} / ${items.length} (점형 제외)
`
  const ts = `${banner}
import type { StreetRoute } from './streetRoutes'

export const WALKWAY_ROUTES: Record<string, StreetRoute> = ${JSON.stringify(routes, null, 0)}
`
  writeFileSync(OUT, ts, 'utf8')
  console.log(`생성 완료: ${OUT}`)
  console.log(`경로 확보 ${Object.keys(routes).length} / ${items.length}`)
  if (failures.length) { console.log(`실패 ${failures.length}건 (예):`); failures.slice(0, 10).forEach((f) => console.log('  -', f)) }
}

main().catch((e) => { console.error(e); process.exit(1) })
