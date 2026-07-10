import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ExploreView } from '@/components/explore/ExploreToggle'
import { MapExplore } from '@/pages/explore/MapExplore'
import { CollectionView } from '@/pages/explore/CollectionView'
import { AdventureView } from '@/pages/explore/AdventureView'

function initialView(param: string | null): ExploreView {
  if (param === 'collection' || param === 'adventure') return param
  return 'map'
}

/** 탐험 탭 — [지도 | 도감 | 모험] 전환. ?view= 딥링크 지원. */
export function ExplorePage() {
  const [params] = useSearchParams()
  const [view, setView] = useState<ExploreView>(initialView(params.get('view')))
  return (
    <div className="h-full w-full">
      {view === 'map' && <MapExplore view={view} onView={setView} />}
      {view === 'collection' && <CollectionView view={view} onView={setView} />}
      {view === 'adventure' && <AdventureView view={view} onView={setView} />}
    </div>
  )
}
