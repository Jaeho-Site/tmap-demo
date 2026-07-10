import { Footprints } from 'lucide-react'
import { PhoneStage } from './SplashScreen'

export type AuthProvider = 'kakao' | 'naver' | 'google' | 'guest'

/** 소셜 로그인 화면(프로토타입: 어떤 버튼이든 실제 인증 없이 바로 진입). */
export function LoginScreen({ onLogin }: { onLogin: (p: AuthProvider) => void }) {
  return (
    <PhoneStage>
      <div className="relative h-full">
        {/* 풍경 히어로 + 하단 그라데이션 */}
        <img src="/images/r4.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-bg/75 to-bg" />

        <div className="relative flex h-full flex-col justify-end px-6 pb-[max(env(safe-area-inset-bottom),28px)]">
          {/* 브랜드 */}
          <div className="so-rise mb-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-[0_8px_30px_rgba(182,243,94,0.35)]">
              <Footprints size={28} className="text-on-primary" />
            </div>
            <h1 className="mt-4 text-[32px] font-extrabold leading-tight">산책온</h1>
            <p className="mt-1.5 text-[15px] font-bold text-fg-muted">
              오늘 걷기 좋은 길, 3초 만에 시작해요
            </p>
          </div>

          {/* 소셜 로그인 */}
          <div className="so-rise space-y-2.5" style={{ animationDelay: '0.15s' }}>
            <SocialButton
              className="bg-[#FEE500] text-[#191600]"
              label="카카오로 시작하기"
              onClick={() => onLogin('kakao')}
              icon={<KakaoMark />}
            />
            <SocialButton
              className="bg-[#03C75A] text-white"
              label="네이버로 시작하기"
              onClick={() => onLogin('naver')}
              icon={<NaverMark />}
            />
            <SocialButton
              className="border border-border bg-white text-[#1f1f1f]"
              label="Google로 시작하기"
              onClick={() => onLogin('google')}
              icon={<GoogleMark />}
            />
          </div>

          <button
            onClick={() => onLogin('guest')}
            className="so-fade mx-auto mt-5 text-sm font-bold text-fg-muted underline-offset-4 hover:underline"
            style={{ animationDelay: '0.4s' }}
          >
            로그인 없이 둘러보기
          </button>

          <p className="so-fade mt-4 text-center text-[11px] leading-relaxed text-fg-muted" style={{ animationDelay: '0.5s' }}>
            계속하면 서비스 약관 및 개인정보 처리방침에 동의하게 됩니다.
          </p>
        </div>
      </div>
    </PhoneStage>
  )
}

function SocialButton({
  label,
  icon,
  className,
  onClick,
}: {
  label: string
  icon: React.ReactNode
  className: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl text-[15px] font-extrabold active:scale-[0.98] transition-transform ${className}`}
    >
      <span className="flex h-5 w-5 items-center justify-center">{icon}</span>
      {label}
    </button>
  )
}

/* ── 브랜드 마크(인라인 SVG, 외부 에셋 없음) ─────────────────────────────── */
function KakaoMark() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="#191600" aria-hidden>
      <path d="M12 3C6.5 3 2 6.5 2 10.8c0 2.8 1.9 5.2 4.7 6.6-.2.7-.7 2.6-.8 3-.1.5.2.5.4.4.3-.2 3-2 4-2.7.5.1 1.1.1 1.7.1 5.5 0 10-3.5 10-7.8S17.5 3 12 3z" />
    </svg>
  )
}
function NaverMark() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="#ffffff" aria-hidden>
      <path d="M15.3 12.5 8.5 3H3v18h5.7v-9.5L15.5 21H21V3h-5.7z" />
    </svg>
  )
}
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.5 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1C3.4 21.3 7.4 24 12 24z" />
      <path fill="#FBBC05" d="M5.4 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4V6.5H1.4C.5 8.2 0 10 0 12s.5 3.8 1.4 5.5l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.4 0 3.4 2.7 1.4 6.5l4 3.1C6.3 6.8 8.9 4.8 12 4.8z" />
    </svg>
  )
}
