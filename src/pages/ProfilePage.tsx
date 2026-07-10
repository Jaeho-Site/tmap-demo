import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings, ChevronRight, Compass, Heart, LogOut } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { listWalks } from '@/features/history/records'
import { computeStats } from '@/features/history/stats'
import { useSaved } from '@/store/saved'
import { formatMetersKm } from '@/lib/format'
import { AUTH_KEY } from '@/app/AppRoot'

const PROVIDER_LABEL: Record<string, string> = {
  kakao: '카카오',
  naver: '네이버',
  google: 'Google',
  guest: '게스트',
}

export function ProfilePage() {
  const navigate = useNavigate()
  const stats = useMemo(() => computeStats(listWalks()), [])
  const savedCount = useSaved((s) => s.ids.length)
  const provider = (typeof localStorage !== 'undefined' && localStorage.getItem(AUTH_KEY)) || 'guest'
  const isGuest = provider === 'guest'

  const logout = () => {
    try {
      localStorage.removeItem(AUTH_KEY)
    } catch {
      /* 무시 */
    }
    window.location.href = '/' // AppRoot 재시작(스플래시 → 로그인)
  }

  return (
    <div>
      <header className="flex items-center justify-between px-4 pt-5 pb-3">
        <h1 className="text-2xl font-extrabold">프로필</h1>
        <button className="flex h-10 w-10 items-center justify-center rounded-full bg-surface">
          <Settings size={20} />
        </button>
      </header>

      <div className="px-4">
        <div className="flex items-center gap-3 py-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-xl font-extrabold">
            {PROVIDER_LABEL[provider]?.[0] ?? '게'}
          </div>
          <div>
            <p className="text-lg font-extrabold">{PROVIDER_LABEL[provider] ?? '게스트'} 워커</p>
            <p className="text-sm text-fg-muted">
              {isGuest ? '로그인 없이 둘러보는 중' : `${PROVIDER_LABEL[provider]} 계정으로 로그인됨`}
            </p>
          </div>
        </div>

        {/* 누적 통계 */}
        <Card className="mt-3">
          <div className="grid grid-cols-3 divide-x divide-border">
            <Stat value={`${stats.totalWalks}`} label="총 산책" />
            <Stat value={formatMetersKm(stats.totalDistanceM)} label="총 거리" />
            <Stat value={`${stats.dayStreak}일`} label="연속" />
          </div>
        </Card>

        <Card className="mt-3">
          <button onClick={() => navigate('/history')} className="flex w-full items-center gap-3 p-4">
            <Compass size={22} className="text-primary" />
            <span className="font-extrabold">로그북</span>
            <ChevronRight size={20} className="ml-auto text-fg-muted" />
          </button>
          <div className="h-px bg-border" />
          <button onClick={() => navigate('/saved')} className="flex w-full items-center gap-3 p-4">
            <Heart size={22} className="text-primary" />
            <span className="font-extrabold">저장한 코스</span>
            <span className="ml-auto text-sm text-fg-muted">{savedCount}개</span>
            <ChevronRight size={20} className="text-fg-muted" />
          </button>
        </Card>

        <Card className="mt-3">
          <button onClick={logout} className="flex w-full items-center gap-3 p-4">
            <LogOut size={22} className="text-danger" />
            <span className="font-extrabold text-danger">{isGuest ? '로그인하기' : '로그아웃'}</span>
            <ChevronRight size={20} className="ml-auto text-fg-muted" />
          </button>
        </Card>

        <p className="mt-6 text-center text-xs text-fg-muted">
          프로토타입 · 소셜 로그인은 실제 인증 없이 데모로 동작합니다
        </p>
      </div>
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 py-4">
      <span className="text-lg font-extrabold tabular-nums">{value}</span>
      <span className="text-[11px] text-fg-muted">{label}</span>
    </div>
  )
}
