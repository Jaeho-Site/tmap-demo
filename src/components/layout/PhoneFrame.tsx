import { Outlet } from 'react-router-dom'

/**
 * 하단 탭이 없는 풀스크린 스택(코스 상세/산책 진행/완료)용 폰 프레임.
 * AppShell과 동일하게, 넓은 화면에서도 480px 모바일 레이아웃을 절대 벗어나지 않도록
 * 검은 레터박스 위에 중앙 정렬한다.
 */
export function PhoneFrame() {
  return (
    <div className="flex min-h-screen w-full justify-center bg-black">
      <div className="relative w-full max-w-[480px] bg-bg shadow-[0_0_40px_rgba(0,0,0,0.5)]">
        <Outlet />
      </div>
    </div>
  )
}
