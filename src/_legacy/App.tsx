import { useState } from 'react'
import './App.css'
import { useTmapSdk } from './hooks/useTmapSdk'
import { MapView } from './components/MapView'
import { Sidebar } from './components/Sidebar'
import { PURPOSES, type PurposeId } from './data/daejeonData'
import { PARK_CATEGORY_COUNTS } from './data/parkMeta'

const INITIAL_LAYERS: Record<PurposeId, boolean> = {
  safety: true,
  nature: true,
  quiet: true,
  joint: true,
}

// 공원 구분별 표시 여부 — 처음엔 모두 켬
const INITIAL_CATEGORIES: Record<string, boolean> = Object.fromEntries(
  PARK_CATEGORY_COUNTS.map((c) => [c.category, true]),
)

function App() {
  const { status, error } = useTmapSdk()
  const [activeLayers, setActiveLayers] = useState(INITIAL_LAYERS)
  const [showParks, setShowParks] = useState(true)
  const [activeCategories, setActiveCategories] = useState(INITIAL_CATEGORIES)
  const [showStreets, setShowStreets] = useState(true)
  const [showWalkways, setShowWalkways] = useState(true)
  const [focus, setFocus] = useState<{ lat: number; lng: number } | null>(null)

  const toggle = (id: PurposeId) =>
    setActiveLayers((prev) => ({ ...prev, [id]: !prev[id] }))

  const toggleCategory = (category: string) =>
    setActiveCategories((prev) => ({ ...prev, [category]: !prev[category] }))

  return (
    <div className="layout">
      <Sidebar
        activeLayers={activeLayers}
        onToggle={toggle}
        onFocus={(lat, lng) => setFocus({ lat, lng })}
        showParks={showParks}
        onToggleParks={() => setShowParks((v) => !v)}
        activeCategories={activeCategories}
        onToggleCategory={toggleCategory}
        showStreets={showStreets}
        onToggleStreets={() => setShowStreets((v) => !v)}
        showWalkways={showWalkways}
        onToggleWalkways={() => setShowWalkways((v) => !v)}
      />

      <main className="map-area">
        {status === 'ready' && (
          <MapView
            activeLayers={activeLayers}
            showParks={showParks}
            activeCategories={activeCategories}
            showStreets={showStreets}
            showWalkways={showWalkways}
            focus={focus}
          />
        )}

        {status === 'loading' && (
          <div className="map-state">
            <div className="spinner" />
            <p>TMAP 지도 SDK 로딩 중…</p>
          </div>
        )}

        {status === 'error' && (
          <div className="map-state error">
            <h2>지도를 불러오지 못했습니다</h2>
            <p>{error}</p>
            <ul>
              <li>인터넷 연결 및 <code>apis.openapi.sk.com</code> 접근 가능 여부 확인</li>
              <li>TMAP 콘솔에서 이 appKey에 <b>현재 도메인(localhost)</b>이 등록됐는지 확인</li>
              <li>키가 JS 지도 SDK용인지 확인 (REST 전용 키로는 지도가 뜨지 않음)</li>
            </ul>
          </div>
        )}

        <div className="map-legend">
          {PURPOSES.map((p) => (
            <span key={p.id} className={activeLayers[p.id] ? '' : 'off'}>
              <i style={{ background: p.color }} />
              {p.emoji} {p.label}
            </span>
          ))}
        </div>
      </main>
    </div>
  )
}

export default App
