import { cn } from '@/lib/utils'

export type ExploreView = 'map' | 'collection' | 'adventure'

const OPTIONS: { id: ExploreView; label: string }[] = [
  { id: 'map', label: '지도' },
  { id: 'collection', label: '도감' },
  { id: 'adventure', label: '모험' },
]

export function ExploreToggle({
  view,
  onChange,
  className,
}: {
  view: ExploreView
  onChange: (v: ExploreView) => void
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex rounded-full bg-surface/95 p-1 backdrop-blur shadow-[0_2px_10px_rgba(0,0,0,0.45)]',
        className,
      )}
    >
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            'h-9 rounded-full px-5 text-sm font-extrabold transition-colors',
            view === o.id ? 'bg-primary text-on-primary' : 'text-fg-muted',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
