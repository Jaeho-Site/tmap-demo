import type { CSSProperties } from 'react'
import {
  PURPOSES,
  DATASETS,
  ALL_POINTS,
  SAFETY_STATS,
  type PurposeId,
} from '../data/daejeonData'
import { PARK_CATEGORY_COUNTS, PARK_TOTAL, parkColor } from '../data/parkMeta'
import { STREET_TOTAL, STREET_TOTAL_LENGTH, STREET_TREE_LEGEND } from '../data/streetMeta'

interface SidebarProps {
  activeLayers: Record<PurposeId, boolean>
  onToggle: (id: PurposeId) => void
  onFocus: (lat: number, lng: number) => void
  showParks: boolean
  onToggleParks: () => void
  activeCategories: Record<string, boolean>
  onToggleCategory: (category: string) => void
  showStreets: boolean
  onToggleStreets: () => void
}

export function Sidebar({
  activeLayers,
  onToggle,
  onFocus,
  showParks,
  onToggleParks,
  activeCategories,
  onToggleCategory,
  showStreets,
  onToggleStreets,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <header className="sidebar-head">
        <h1>산책온 · 대전 MVP</h1>
        <p>TMAP 지도 위에 대전 4대 산책 목적 데이터풀을 얹은 시제품</p>
      </header>

      <section className="panel">
        <h2>레이어</h2>
        <div className="layer-list">
          {PURPOSES.map((p) => {
            const count = ALL_POINTS.filter((pt) => pt.purpose === p.id).length
            return (
              <label key={p.id} className="layer-item" style={{ borderLeftColor: p.color }}>
                <input
                  type="checkbox"
                  checked={activeLayers[p.id]}
                  onChange={() => onToggle(p.id)}
                />
                <span className="layer-emoji">{p.emoji}</span>
                <span className="layer-label">
                  {p.label}
                  <small>
                    {'●'.repeat(p.thickness)}
                    <span className="dim">{'●'.repeat(4 - p.thickness)}</span> · {p.verdict}
                  </small>
                </span>
                {count > 0 && <span className="layer-count">{count}</span>}
              </label>
            )
          })}
        </div>
      </section>

      <section className="panel">
        <div className="park-head">
          <h2>🌲 도시공원 노드 ({PARK_TOTAL})</h2>
          <label className="park-master">
            <input type="checkbox" checked={showParks} onChange={onToggleParks} />
            <span>전체 표시</span>
          </label>
        </div>
        <p className="foot" style={{ marginTop: 0, marginBottom: 10 }}>
          대전 5개 구 도시공원정보 CSV의 모든 위경도 지점 · 구분별로 켜고 끄기
        </p>
        <div className="chip-list">
          {PARK_CATEGORY_COUNTS.map(({ category, count }) => {
            const on = showParks && activeCategories[category] !== false
            return (
              <button
                key={category}
                type="button"
                className={`chip ${on ? 'on' : ''}`}
                style={{ '--chip': parkColor(category) } as CSSProperties}
                onClick={() => onToggleCategory(category)}
                disabled={!showParks}
              >
                <i />
                {category}
                <em>{count}</em>
              </button>
            )
          })}
        </div>
      </section>

      <section className="panel">
        <div className="park-head">
          <h2>🌸 가로수길 ({STREET_TOTAL})</h2>
          <label className="park-master">
            <input type="checkbox" checked={showStreets} onChange={onToggleStreets} />
            <span>연결선 표시</span>
          </label>
        </div>
        <p className="foot" style={{ marginTop: 0, marginBottom: 10 }}>
          시작(◆)·종료(●) 각각 노드 · 둘 사이는 <b>TMAP 보행자 경로</b>로 연결 · 총 연장 약 {STREET_TOTAL_LENGTH}km
        </p>
        <div className="chip-list">
          {STREET_TREE_LEGEND.map((t) => (
            <span key={t.label} className="chip on static" style={{ '--chip': t.color } as CSSProperties}>
              <i />
              {t.label}
            </span>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>지도 위 지점</h2>
        {PURPOSES.map((p) => {
          const pts = ALL_POINTS.filter((pt) => pt.purpose === p.id)
          if (pts.length === 0) return null
          return (
            <div key={p.id} className="point-group">
              <h3 style={{ color: p.color }}>
                {p.emoji} {p.label}
              </h3>
              <ul>
                {pts.map((pt) => (
                  <li key={pt.id}>
                    <button
                      type="button"
                      disabled={!activeLayers[p.id]}
                      onClick={() => onFocus(pt.lat, pt.lng)}
                    >
                      <span>{pt.name}</span>
                      {pt.metric && <em style={{ color: p.color }}>{pt.metric}</em>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </section>

      <section className="panel">
        <h2>안전 통계 (대전)</h2>
        <div className="stat-row">
          <div className="stat">
            <strong>{SAFETY_STATS.pedestrianAccidentShare}%</strong>
            <span>사고 중 보행자</span>
          </div>
          <div className="stat">
            <strong>{SAFETY_STATS.crossingShare}%</strong>
            <span>교차로 횡단 중</span>
          </div>
        </div>
        <p className="foot">→ 위험 교차로 회피 가중치의 근거 (1차 보고서)</p>
      </section>

      <section className="panel">
        <h2>데이터풀 출처</h2>
        <ul className="dataset-list">
          {DATASETS.map((d) => {
            const p = PURPOSES.find((x) => x.id === d.purpose)!
            return (
              <li key={d.title}>
                <a href={d.url} target="_blank" rel="noreferrer">
                  <span className="ds-title" style={{ borderLeftColor: p.color }}>
                    {p.emoji} {d.title}
                  </span>
                  <span className="ds-scale">{d.scale}</span>
                  <span className="ds-note">{d.note}</span>
                </a>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="panel note">
        <h2>ℹ️ TMAP 경로 데이터</h2>
        <p>
          가로수길 연결선은 <b>TMAP 보행자 경로안내 API</b>로 미리 계산해 구운 실제 보행 경로입니다
          (빌드 시 1회 호출 · 재생성 <code>node scripts/fetchStreetRoutes.mjs</code>).
          291/314 구간은 실경로, 나머지는 TMAP가 경로를 못 찾아 직선(점선)으로 폴백합니다.
        </p>
      </section>
    </aside>
  )
}
