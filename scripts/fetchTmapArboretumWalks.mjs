// 한밭수목원 내부 OSM 공원 산책로 노드의 시작→종료를 TMAP 보행자 경로안내 API로 재계산
// → src/data/tmapArboretumWalks.ts 로 굽는다.
// 재생성: node scripts/fetchTmapArboretumWalks.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OSM_TS = join(__dirname, '..', 'src', 'data', 'osmPaths.ts')
const OUT = join(__dirname, '..', 'src', 'data', 'tmapArboretumWalks.ts')
const CACHE = join(__dirname, '.arboretum-route-cache.json')

process.loadEnvFile(join(__dirname, '..', '.env'))
const APP_KEY = process.env.VITE_TMAP_APP_KEY
if (!APP_KEY) throw new Error('VITE_TMAP_APP_KEY 가 .env 에 없습니다.')

const ENDPOINT = 'https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json'
const DELAY_MS = 130
const MIN_SEGMENT_METERS = 30
const HANBAT_BBOX = {
  south: 36.3635,
  west: 127.3835,
  north: 36.3695,
  east: 127.3945,
}

function loadOsmPaths() {
  const text = readFileSync(OSM_TS, 'utf8')
  const marker = 'export const OSM_PATHS: OsmPath[] = '
  const at = text.indexOf(marker)
  if (at < 0) throw new Error('OSM_PATHS 배열을 찾지 못함')
  return JSON.parse(text.slice(at + marker.length).trim().replace(/;?\s*$/, ''))
}

function inHanbat(node) {
  return (
    node.lat >= HANBAT_BBOX.south &&
    node.lat <= HANBAT_BBOX.north &&
    node.lng >= HANBAT_BBOX.west &&
    node.lng <= HANBAT_BBOX.east
  )
}

function distanceMeters(a, b) {
  const rad = Math.PI / 180
  const lat1 = a.lat * rad
  const lat2 = b.lat * rad
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function pathLength(nodes) {
  let total = 0
  for (let i = 1; i < nodes.length; i++) total += distanceMeters(nodes[i - 1], nodes[i])
  return Math.round(total)
}

function buildSegments() {
  const segments = []
  const osmPaths = loadOsmPaths().filter((path) => path.category === 'park_walk')

  for (const path of osmPaths) {
    let chunk = []
    let chunkIndex = 0

    const flush = () => {
      if (chunk.length < 2) {
        chunk = []
        return
      }

      const length = pathLength(chunk)
      if (length >= MIN_SEGMENT_METERS) {
        const start = chunk[0]
        const end = chunk[chunk.length - 1]
        segments.push({
          id: `hanbat-${path.osmId}-${chunkIndex}`,
          osmId: path.osmId,
          name: `한밭수목원 내부 산책로 ${segments.length + 1}`,
          startName: 'OSM 산책로 시작 노드',
          endName: 'OSM 산책로 종료 노드',
          startLat: start.lat,
          startLng: start.lng,
          endLat: end.lat,
          endLng: end.lng,
          osmLength: length,
          osmNodeCount: chunk.length,
        })
        chunkIndex++
      }
      chunk = []
    }

    for (const node of path.nodes) {
      if (inHanbat(node)) chunk.push(node)
      else flush()
    }
    flush()
  }

  return segments.sort((a, b) => b.osmLength - a.osmLength)
}

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

  const routePath = []
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
        const last = routePath[routePath.length - 1]
        if (!last || last[0] !== point[0] || last[1] !== point[1]) routePath.push(point)
      }
    }
  }

  if (routePath.length < 2) throw new Error('경로 좌표 부족')
  return { path: routePath, distance, time }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function main() {
  const segments = buildSegments()
  const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {}
  let ok = 0
  let cached = 0
  let fail = 0
  const failures = []

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    if (cache[segment.id]?.path?.length >= 2) {
      cached++
      continue
    }

    try {
      cache[segment.id] = await fetchRoute(segment)
      ok++
    } catch (error) {
      fail++
      failures.push(`${segment.id}: ${error.message}`)
    }

    if ((i + 1) % 10 === 0 || i === segments.length - 1) {
      writeFileSync(CACHE, JSON.stringify(cache), 'utf8')
      process.stdout.write(`\r진행 ${i + 1}/${segments.length} · 신규성공 ${ok} 캐시 ${cached} 실패 ${fail}   `)
    }
    await sleep(DELAY_MS)
  }
  console.log()

  const routes = []
  for (const segment of segments) {
    const route = cache[segment.id]
    if (route?.path?.length >= 2) routes.push({ ...segment, ...route })
  }

  const totalDistance = routes.reduce((sum, route) => sum + (route.distance || 0), 0)
  const totalNodes = routes.reduce((sum, route) => sum + route.path.length, 0)
  const banner = `// 자동 생성 파일 — 수정 금지. 재생성: node scripts/fetchTmapArboretumWalks.mjs
// 한밭수목원 내부 OSM 공원 산책로 노드끼리를 TMAP 보행자 경로안내 API로 재계산한 경로.
// OSM 후보 ${segments.length}개 · TMAP 경로 ${routes.length}개 · 총 ${totalDistance}m · 노드 ${totalNodes}개
`

  const ts = `${banner}
export interface TmapArboretumWalk {
  id: string
  osmId: number
  name: string
  startName: string
  endName: string
  startLat: number
  startLng: number
  endLat: number
  endLng: number
  osmLength: number
  osmNodeCount: number
  path: [number, number][] // [lat, lng]
  distance: number | null
  time: number | null
}

export const TMAP_ARBORETUM_WALKS: TmapArboretumWalk[] = ${JSON.stringify(routes, null, 0)}
`

  writeFileSync(OUT, ts, 'utf8')
  console.log(`생성 완료: ${OUT}`)
  console.log(`OSM 후보 ${segments.length}개 · TMAP 경로 ${routes.length}개 · 실패 ${fail}개`)
  if (failures.length) failures.slice(0, 10).forEach((failure) => console.log('  -', failure))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
