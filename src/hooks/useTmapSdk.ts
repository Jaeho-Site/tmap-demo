import { useEffect, useState } from 'react'

type SdkStatus = 'loading' | 'ready' | 'error'

// TMAP JS SDK(jsv2)는 index.html에서 동기 로드된다(document.write 부트스트랩 특성상 동적 주입 불가).
// 여기서는 내부 SDK(tmapjs2.min.js)까지 실제로 준비될 때까지 폴링만 한다.
export function useTmapSdk(): { status: SdkStatus; error?: string } {
  const [status, setStatus] = useState<SdkStatus>(window.Tmapv2?.Map ? 'ready' : 'loading')
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (window.Tmapv2?.Map) {
      setStatus('ready')
      return
    }
    let tries = 0
    const timer = setInterval(() => {
      if (window.Tmapv2?.Map) {
        clearInterval(timer)
        setStatus('ready')
      } else if (tries++ > 100) {
        // 약 10초 대기 후에도 준비 안 되면 실패 처리
        clearInterval(timer)
        setError('TMAP SDK가 준비되지 않았습니다. appKey·도메인 등록·네트워크를 확인하세요.')
        setStatus('error')
      }
    }, 100)
    return () => clearInterval(timer)
  }, [])

  return { status, error }
}
