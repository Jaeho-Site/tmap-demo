import { useEffect, useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { SplashScreen } from '@/components/startup/SplashScreen'
import { LoginScreen, type AuthProvider } from '@/components/startup/LoginScreen'

export const AUTH_KEY = 'sanchaek.auth'

type Phase = 'splash' | 'login' | 'app'

/** 앱 최상위 게이트: 시작 스플래시 → (미인증 시) 로그인 → 라우터. */
export function AppRoot() {
  const [phase, setPhase] = useState<Phase>('splash')
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const authed = !!localStorage.getItem(AUTH_KEY)
    const t1 = setTimeout(() => setLeaving(true), 1600) // 페이드아웃 시작
    const t2 = setTimeout(() => setPhase(authed ? 'app' : 'login'), 2000)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  const handleLogin = (provider: AuthProvider) => {
    // 프로토타입: 실제 인증 없이 provider만 저장하고 바로 진입
    try {
      localStorage.setItem(AUTH_KEY, provider)
    } catch {
      /* 저장 실패 무시 */
    }
    setPhase('app')
  }

  if (phase === 'splash') return <SplashScreen leaving={leaving} />
  if (phase === 'login') return <LoginScreen onLogin={handleLogin} />
  return <RouterProvider router={router} />
}
