import { Footprints } from 'lucide-react'

/** 앱 시작 스플래시. 폰 프레임 안에서 로고 팝인 + 링 펄스 + 워드마크 등장. */
export function SplashScreen({ leaving }: { leaving?: boolean }) {
  return (
    <PhoneStage>
      <div
        className={`relative flex h-full flex-col items-center justify-center bg-bg ${
          leaving ? 'so-leaving' : ''
        }`}
      >
        {/* 로고 마크 + 펄스 링 */}
        <div className="relative flex items-center justify-center">
          <span className="absolute h-24 w-24 rounded-[28px] bg-primary/30 so-ring" />
          <span
            className="absolute h-24 w-24 rounded-[28px] bg-primary/30 so-ring"
            style={{ animationDelay: '0.6s' }}
          />
          <div className="so-pop flex h-24 w-24 items-center justify-center rounded-[28px] bg-primary shadow-[0_10px_40px_rgba(182,243,94,0.35)]">
            <Footprints size={44} className="text-on-primary" />
          </div>
        </div>

        {/* 워드마크 */}
        <h1 className="so-rise mt-7 text-4xl font-extrabold tracking-tight" style={{ animationDelay: '0.35s' }}>
          산책온
        </h1>
        <p className="so-fade mt-2 text-sm font-bold text-fg-muted" style={{ animationDelay: '0.7s' }}>
          동네 한 바퀴, 오늘의 산책
        </p>

        {/* 하단 로딩 점 */}
        <div className="absolute bottom-16 flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 animate-bounce rounded-full bg-primary/70"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </PhoneStage>
  )
}

/** 스플래시·로그인 공용 폰 프레임(모바일 레이아웃 유지). */
export function PhoneStage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full justify-center bg-black">
      <div className="relative h-screen w-full max-w-[480px] overflow-hidden bg-bg shadow-[0_0_40px_rgba(0,0,0,0.5)]">
        {children}
      </div>
    </div>
  )
}
