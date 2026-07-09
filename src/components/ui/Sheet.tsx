import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** 시트 제목(선택) */
  title?: string
  className?: string
}

/**
 * 하단 바텀시트 (네이버지도/AllTrails 톤). 드래그 핸들 + 백드롭.
 * 열림/닫힘 슬라이드 트랜지션 포함. 모달이지만 백드롭 탭으로 닫힘(비강제).
 */
export function Sheet({ open, onClose, children, title, className }: SheetProps) {
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      // 다음 프레임에 visible → 슬라이드 인
      const id = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(id)
    }
    setVisible(false)
    const t = setTimeout(() => setMounted(false), 260)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!mounted) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* 백드롭 */}
      <div
        onClick={onClose}
        className={cn(
          'absolute inset-0 bg-black/60 transition-opacity duration-[250ms]',
          visible ? 'opacity-100' : 'opacity-0',
        )}
      />
      {/* 시트 */}
      <div
        className={cn(
          'relative w-full max-w-[480px] bg-surface rounded-t-[24px] pb-[max(env(safe-area-inset-bottom),16px)]',
          'transition-transform duration-[250ms] ease-out will-change-transform',
          visible ? 'translate-y-0' : 'translate-y-full',
          className,
        )}
      >
        {/* 드래그 핸들 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1.5 w-10 rounded-full bg-surface-2" />
        </div>
        {title && <h2 className="px-5 pt-2 pb-1 text-xl font-extrabold">{title}</h2>}
        <div className="px-5 pt-2">{children}</div>
      </div>
    </div>
  )
}
