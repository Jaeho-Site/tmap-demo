import { NavLink } from 'react-router-dom'
import { Home, Map, Activity, Heart, PawPrint, User, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Tab {
  to: string
  label: string
  icon: LucideIcon
}

// 산책온 5탭 (DESIGN_SYSTEM §5). 산책 루프는 탭이 아니라 홈에서 여는 스택 플로우.
const TABS: Tab[] = [
  { to: '/', label: '홈', icon: Home },
  { to: '/explore', label: '탐험', icon: Map },
  { to: '/history', label: '기록', icon: Activity },
  { to: '/saved', label: '저장', icon: Heart },
  { to: '/partner', label: '파트너', icon: PawPrint },
  { to: '/profile', label: '프로필', icon: User },
]

export function BottomTabBar() {
  return (
    <nav className="shrink-0 border-t border-border bg-bg pb-[max(env(safe-area-inset-bottom),6px)]">
      <ul className="flex">
        {TABS.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-1 pt-2.5 pb-1.5 transition-colors',
                  isActive ? 'text-fg' : 'text-fg-muted',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={24} strokeWidth={isActive ? 2.4 : 1.9} />
                  <span className="text-[11px] font-bold">{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
