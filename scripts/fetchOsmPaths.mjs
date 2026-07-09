// OSM Overpass API에서 대전 공원 내부 산책로와 하천변 보행로를 수집 → src/data/osmPaths.ts
// 재생성: node scripts/fetchOsmPaths.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'src', 'data', 'osmPaths.ts')
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]
const DAEJEON_BBOX = {
  south: 36.18,
  west: 127.24,
  north: 36.5,
  east: 127.53,
}

const PARK_QUERY = `
[out:json][timeout:180];
area["boundary"="administrative"]["wikidata"="Q20921"]->.daejeon;
(
  way(area.daejeon)["leisure"~"^(park|garden|recreation_ground)$"];
  relation(area.daejeon)["leisure"~"^(park|garden|recreation_ground)$"];
)->.parks;
.parks map_to_area->.parkareas;
(
  way(area.parkareas)["highway"~"^(footway|path|pedestrian|steps)$"];
);
out body;
>;
out skel qt;
`

const RIVER_QUERY = `
[out:json][timeout:180];
(
  way(${DAEJEON_BBOX.south},${DAEJEON_BBOX.west},${DAEJEON_BBOX.north},${DAEJEON_BBOX.east})["waterway"~"^(river|stream|canal)$"];
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

function isInDaejeonBbox(node) {
  return (
    node.lat >= DAEJEON_BBOX.south &&
    node.lat <= DAEJEON_BBOX.north &&
    node.lng >= DAEJEON_BBOX.west &&
    node.lng <= DAEJEON_BBOX.east
  )
}

function pathCenter(nodes) {
  return {
    lat: nodes.reduce((sum, node) => sum + node.lat, 0) / nodes.length,
    lng: nodes.reduce((sum, node) => sum + node.lng, 0) / nodes.length,
  }
}

async function fetchOverpass(query) {
  const errors = []
  for (const endpoint of ENDPOINTS) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 45000)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent': 'tmap-demo-osm-fetch/1.0',
        },
        body: new URLSearchParams({ data: query }),
        signal: controller.signal,
      })
      if (res.ok) return res.json()
      const text = await res.text()
      errors.push(`${endpoint} HTTP ${res.status}: ${text.slice(0, 300)}`)
    } catch (error) {
      errors.push(`${endpoint}: ${error.message}`)
    } finally {
      clearTimeout(timeout)
    }
  }
  throw new Error(errors.join('\n'))
}

function extractPaths(json, category) {
  const nodesById = new Map()
  for (const el of json.elements) {
    if (el.type === 'node') nodesById.set(el.id, { lat: el.lat, lng: el.lon })
  }

  const paths = []
  for (const el of json.elements) {
    if (el.type !== 'way' || !Array.isArray(el.nodes)) continue

    const nodes = el.nodes
      .map((id) => nodesById.get(id))
      .filter(Boolean)
      .map((node) => ({ lat: roundCoord(node.lat), lng: roundCoord(node.lng) }))

    if (nodes.length < 2) continue
    if (category === 'river_walk' && !isInDaejeonBbox(pathCenter(nodes))) continue

    const tags = el.tags || {}
    paths.push({
      id: `osm-${el.id}`,
      osmId: el.id,
      category,
      name: tagName(tags, category === 'park_walk' ? '공원 내부 산책로' : '하천변 보행로'),
      highway: tags.highway || '',
      surface: tags.surface || '',
      length: pathLength(nodes),
      nodes,
    })
  }
  return paths
}

function loadExistingPaths() {
  if (!existsSync(OUT)) return []
  const text = readFileSync(OUT, 'utf8')
  const marker = 'export const OSM_PATHS: OsmPath[] = '
  const at = text.indexOf(marker)
  if (at < 0) return []
  return JSON.parse(text.slice(at + marker.length).trim().replace(/;?\s*$/, ''))
}

function writePaths(paths) {
  paths.sort((a, b) => b.length - a.length)
  const parkCount = paths.filter((p) => p.category === 'park_walk').length
  const riverCount = paths.filter((p) => p.category === 'river_walk').length
  const nodeCount = paths.reduce((sum, p) => sum + p.nodes.length, 0)
  const totalLength = paths.reduce((sum, p) => sum + p.length, 0)
  const fetchedAt = new Date().toISOString()

  const banner = `// 자동 생성 파일 — 수정 금지. 재생성: node scripts/fetchOsmPaths.mjs
// 출처: OpenStreetMap Overpass API, 대전광역시 영역
// 수집: ${fetchedAt} · 경로 ${paths.length}개 · 노드 ${nodeCount}개 · 총 ${Math.round(totalLength / 1000)}km
`

  const ts = `${banner}
export type OsmPathCategory = 'park_walk' | 'river_walk'

export interface OsmPathNode {
  lat: number
  lng: number
}

export interface OsmPath {
  id: string
  osmId: number
  category: OsmPathCategory
  name: string
  highway: string
  surface: string
  length: number
  nodes: OsmPathNode[]
}

export const OSM_PATHS: OsmPath[] = ${JSON.stringify(paths, null, 0)}
`

  writeFileSync(OUT, ts, 'utf8')
  console.log(`생성 완료: ${OUT}`)
  console.log(`공원 내부 산책로 ${parkCount}개 · 하천변 보행로 ${riverCount}개 · 노드 ${nodeCount}개`)
}

async function main() {
  if (process.argv.includes('--filter-existing')) {
    const paths = loadExistingPaths().filter((path) => {
      if (path.category !== 'river_walk') return true
      return isInDaejeonBbox(pathCenter(path.nodes))
    })
    writePaths(paths)
    return
  }

  const riverOnly = process.argv.includes('--river-only')
  const parkJson = riverOnly ? null : await fetchOverpass(PARK_QUERY)
  const riverJson = await fetchOverpass(RIVER_QUERY)

  const byId = new Map()
  if (riverOnly) {
    for (const path of loadExistingPaths().filter((p) => p.category === 'park_walk')) {
      byId.set(path.osmId, path)
    }
  }
  for (const path of extractPaths(riverJson, 'river_walk')) byId.set(path.osmId, path)
  if (parkJson) {
    for (const path of extractPaths(parkJson, 'park_walk')) byId.set(path.osmId, path)
  }

  const paths = [...byId.values()]
  writePaths(paths)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
