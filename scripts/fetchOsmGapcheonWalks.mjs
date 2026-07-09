// 충남대학교~엑스포공원 사이 갑천 주변 OSM 보행/산책로를 수집
// → src/data/osmGapcheonWalks.ts
// 재생성: node scripts/fetchOsmGapcheonWalks.mjs
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'src', 'data', 'osmGapcheonWalks.ts')
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

// 충남대학교 서측 갑천변부터 엑스포공원/엑스포다리 일대까지.
// 실제 산책로가 하천 중심선에서 조금 떨어져 있는 구간이 있어 여유 bbox/반경을 둔다.
const BBOX = {
  south: 36.34,
  west: 127.325,
  north: 36.386,
  east: 127.41,
}

const QUERY = `
[out:json][timeout:90];
(
  way(${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east})["waterway"~"^(river|stream|canal)$"]["name"~"갑천"];
)->.gapcheon;
(
  way(around.gapcheon:170)(${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east})["highway"~"^(footway|path|pedestrian|cycleway|track|service)$"];
);
out body;
>;
out skel qt;
`

function roundCoord(value) {
  return Number(value.toFixed(6))
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

function tagName(tags, fallback) {
  return tags?.name || tags?.['name:ko'] || tags?.['name:en'] || fallback
}

async function fetchOverpass() {
  const errors = []
  for (const endpoint of ENDPOINTS) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 45000)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent': 'tmap-demo-gapcheon-walk-fetch/1.0',
        },
        body: new URLSearchParams({ data: QUERY }),
        signal: controller.signal,
      })
      if (res.ok) return res.json()
      errors.push(`${endpoint} HTTP ${res.status}: ${(await res.text()).slice(0, 240)}`)
    } catch (error) {
      errors.push(`${endpoint}: ${error.message}`)
    } finally {
      clearTimeout(timeout)
    }
  }
  throw new Error(errors.join('\n'))
}

async function main() {
  const json = await fetchOverpass()
  const nodesById = new Map()
  for (const el of json.elements) {
    if (el.type === 'node') nodesById.set(el.id, { lat: el.lat, lng: el.lon })
  }

  const walks = []
  for (const el of json.elements) {
    if (el.type !== 'way' || !Array.isArray(el.nodes) || !el.tags?.highway) continue
    const nodes = el.nodes
      .map((id) => nodesById.get(id))
      .filter(Boolean)
      .map((node) => ({ lat: roundCoord(node.lat), lng: roundCoord(node.lng) }))
    if (nodes.length < 2) continue

    walks.push({
      id: `gapcheon-${el.id}`,
      osmId: el.id,
      name: tagName(el.tags, '갑천 주변 산책로'),
      highway: el.tags.highway || '',
      surface: el.tags.surface || '',
      bicycle: el.tags.bicycle || '',
      foot: el.tags.foot || '',
      length: pathLength(nodes),
      nodes,
    })
  }

  walks.sort((a, b) => b.length - a.length)
  const nodeCount = walks.reduce((sum, walk) => sum + walk.nodes.length, 0)
  const totalLength = walks.reduce((sum, walk) => sum + walk.length, 0)
  const banner = `// 자동 생성 파일 — 수정 금지. 재생성: node scripts/fetchOsmGapcheonWalks.mjs
// 출처: OpenStreetMap Overpass API
// 범위: 충남대학교~엑스포공원 사이 갑천 주변 170m 보행/산책로
// 경로 ${walks.length}개 · 노드 ${nodeCount}개 · 총 ${Math.round(totalLength / 1000)}km
`

  const ts = `${banner}
export interface OsmGapcheonWalkNode {
  lat: number
  lng: number
}

export interface OsmGapcheonWalk {
  id: string
  osmId: number
  name: string
  highway: string
  surface: string
  bicycle: string
  foot: string
  length: number
  nodes: OsmGapcheonWalkNode[]
}

export const OSM_GAPCHEON_WALKS: OsmGapcheonWalk[] = ${JSON.stringify(walks, null, 0)}
`

  writeFileSync(OUT, ts, 'utf8')
  console.log(`생성 완료: ${OUT}`)
  console.log(`갑천 주변 산책로 ${walks.length}개 · 노드 ${nodeCount}개 · 총 ${Math.round(totalLength / 1000)}km`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
