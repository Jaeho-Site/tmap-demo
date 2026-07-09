import { Outlet } from 'react-router-dom'
import { BottomTabBar } from './BottomTabBar'

/**
 * 모바일 우선 앱 셸. 넓은 화면에서는 480px 폰 프레임으로 중앙 정렬,
 * 모바일에서는 풀블리드. 하단 탭 고정 + 본문 스크롤.
 */
export function AppShell() {
  return (
    <div className="min-h-full w-full flex justify-center bg-black">
      <div className="relative flex h-screen w-full max-w-[480px] flex-col overflow-hidden bg-bg shadow-[0_0_40px_rgba(0,0,0,0.5)]">
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
        <BottomTabBar />
      </div>
    </div>
  )
}
