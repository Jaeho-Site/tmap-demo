import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ExploreView } from '@/components/explore/ExploreToggle'
import { MapExplore } from '@/pages/explore/MapExplore'
import { CollectionView } from '@/pages/explore/CollectionView'

/** 탐험 탭 — [지도 | 도감] 전환. ?view=collection 딥링크 지원. */
export function ExplorePage() {
  const [params] = useSearchParams()
  const [view, setView] = useState<ExploreView>(
    params.get('view') === 'collection' ? 'collection' : 'map',
  )
  return (
    <div className="h-full w-full">
      {view === 'map' ? (
        <MapExplore view={view} onView={setView} />
      ) : (
        <CollectionView view={view} onView={setView} />
      )}
    </div>
  )
}
