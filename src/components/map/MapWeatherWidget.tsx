import { Cloud } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * 네이버지도 좌상단 날씨 위젯(목업). 좋은 날 넛지(UX P10)와 연결 예정.
 * 실제 대기질/날씨 API는 이후 단계에서 연동.
 */
export function MapWeatherWidget({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-0.5 rounded-2xl bg-surface/95 px-3 py-2 backdrop-blur shadow-[0_2px_10px_rgba(0,0,0,0.45)]',
        className,
      )}
    >
      <Cloud size={18} className="text-fg-muted" />
      <span className="text-lg font-extrabold leading-none">24°</span>
      <span className="text-[11px] font-bold text-primary">미세 좋음</span>
    </div>
  )
}
