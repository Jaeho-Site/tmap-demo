import { Layers, Plus, Minus, LocateFixed } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MapControlsProps {
  onLayers?: () => void
  onZoomIn?: () => void
  onZoomOut?: () => void
  onLocate?: () => void
  locating?: boolean
  className?: string
}

const ctrlBtn =
  'flex h-11 w-11 items-center justify-center bg-surface/95 backdrop-blur text-fg shadow-[0_2px_10px_rgba(0,0,0,0.45)] active:scale-95 transition-transform'

/** 네이버지도 스타일 우측 플로팅 컨트롤 스택. */
export function MapControls({
  onLayers,
  onZoomIn,
  onZoomOut,
  onLocate,
  locating,
  className,
}: MapControlsProps) {
  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <button onClick={onLayers} className={cn(ctrlBtn, 'rounded-full')} aria-label="레이어">
        <Layers size={20} />
      </button>

      {/* 줌 캡슐 */}
      <div className="overflow-hidden rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.45)]">
        <button onClick={onZoomIn} className={cn(ctrlBtn, 'rounded-none shadow-none')} aria-label="확대">
          <Plus size={20} />
        </button>
        <div className="h-px w-full bg-border" />
        <button onClick={onZoomOut} className={cn(ctrlBtn, 'rounded-none shadow-none')} aria-label="축소">
          <Minus size={20} />
        </button>
      </div>

      <button
        onClick={onLocate}
        className={cn(ctrlBtn, 'rounded-full', locating && 'text-primary')}
        aria-label="현위치"
      >
        <LocateFixed size={20} className={cn(locating && 'animate-pulse')} />
      </button>
    </div>
  )
}
