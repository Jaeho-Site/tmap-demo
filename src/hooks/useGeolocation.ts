import { useCallback, useState } from 'react'
import type { LatLng } from '@/types/course'

interface GeoState {
  coords: LatLng | null
  accuracy: number | null
  loading: boolean
  error: string | null
}

/**
 * 현위치 획득 훅 (US-1.1). 권한/정확도 값을 함께 다루고, 거부 시 우아하게 폴백.
 * 지속 백그라운드 추적 없음(최소 수집, UX P10).
 */
export function useGeolocation() {
  const [state, setState] = useState<GeoState>({
    coords: null,
    accuracy: null,
    loading: false,
    error: null,
  })

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState((s) => ({ ...s, error: '이 기기에서 위치를 사용할 수 없어요.' }))
      return
    }
    setState((s) => ({ ...s, loading: true, error: null }))
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          accuracy: pos.coords.accuracy,
          loading: false,
          error: null,
        })
      },
      (err) => {
        setState((s) => ({
          ...s,
          loading: false,
          error: err.code === err.PERMISSION_DENIED ? '위치 권한이 거부되었어요.' : '위치를 가져오지 못했어요.',
        }))
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    )
  }, [])

  return { ...state, request }
}
