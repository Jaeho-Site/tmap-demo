import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { PhoneFrame } from '@/components/layout/PhoneFrame'
import { HomePage } from '@/pages/HomePage'
import { ExplorePage } from '@/pages/ExplorePage'
import { HistoryPage } from '@/pages/HistoryPage'
import { SavedPage } from '@/pages/SavedPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { CourseDetailPage } from '@/pages/CourseDetailPage'
import { WalkPage } from '@/pages/WalkPage'
import { WalkCompletePage } from '@/pages/WalkCompletePage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'explore', element: <ExplorePage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'saved', element: <SavedPage /> },
      { path: 'profile', element: <ProfilePage /> },
    ],
  },
  // 산책 루프 — 하단 탭 없는 풀스크린 스택(폰 프레임 유지)
  {
    element: <PhoneFrame />,
    children: [
      { path: '/course/:id', element: <CourseDetailPage /> },
      { path: '/walk/:id', element: <WalkPage /> },
      { path: '/complete/:recordId', element: <WalkCompletePage /> },
    ],
  },
])
