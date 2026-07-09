// 한밭수목원 북쪽 갑천변 기준점을 TMAP 보행자 경로안내 API로 연결
// → src/data/tmapRiverWalks.ts 로 굽는다.
// 재생성: node scripts/fetchTmapRiverWalks.mjs
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'src', 'data', 'tmapRiverWalks.ts')

process.loadEnvFile(join(__dirname, '..', '.env'))
const APP_KEY = process.env.VITE_TMAP_APP_KEY
if (!APP_KEY) throw new Error('VITE_TMAP_APP_KEY 가 .env 에 없습니다.')

const ENDPOINT = 'https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json'

const SEGMENTS = [
  {
    id: 'gapcheon-hanbat-north',
    name: '한밭수목원 북측 갑천 보행로',
    river: '갑천',
    startName: '만년교 방면',
    endName: '엑스포다리 방면',
    startLat: 36.3705,
    startLng: 127.3792,
    endLat: 36.3718,
    endLng: 127.3939,
  },
]

async function fetchRoute(segment) {
  const body = {
    startX: String(segment.startLng),
    startY: String(segment.startLat),
    endX: String(segment.endLng),
    endY: String(segment.endLat),
    startName: segment.startName,
    endName: segment.endName,
    reqCoordType: 'WGS84GEO',
    resCoordType: 'WGS84GEO',
    searchOption: '0',
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { appKey: APP_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)

  const json = await res.json()
  if (!json.features) throw new Error('features 없음')

  const path = []
  let distance = null
  let time = null

  for (const feature of json.features) {
    const props = feature.properties || {}
    if (distance == null && props.totalDistance != null) {
      distance = props.totalDistance
      time = props.totalTime
    }
    if (feature.geometry?.type === 'LineString') {
      for (const [lng, lat] of feature.geometry.coordinates) {
        const point = [Number(lat.toFixed(6)), Number(lng.toFixed(6))]
        const last = path[path.length - 1]
        if (!last || last[0] !== point[0] || last[1] !== point[1]) path.push(point)
      }
    }
  }

  if (path.length < 2) throw new Error('경로 좌표 부족')
  return { path, distance, time }
}

async function main() {
  const routes = []
  for (const segment of SEGMENTS) {
    const route = await fetchRoute(segment)
    routes.push({ ...segment, ...route })
    console.log(`${segment.name}: ${route.distance}m · 노드 ${route.path.length}`)
  }

  const banner = `// 자동 생성 파일 — 수정 금지. 재생성: node scripts/fetchTmapRiverWalks.mjs
// TMAP 보행자 경로안내 API로 계산한 한밭수목원 북측 갑천 보행 경로.
// 경로 ${routes.length}개 · 총 ${routes.reduce((sum, route) => sum + (route.distance || 0), 0)}m
`

  const ts = `${banner}
export interface TmapRiverWalk {
  id: string
  name: string
  river: string
  startName: string
  endName: string
  startLat: number
  startLng: number
  endLat: number
  endLng: number
  path: [number, number][] // [lat, lng]
  distance: number | null
  time: number | null
}

export const TMAP_RIVER_WALKS: TmapRiverWalk[] = ${JSON.stringify(routes, null, 0)}
`

  writeFileSync(OUT, ts, 'utf8')
  console.log(`생성 완료: ${OUT}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
