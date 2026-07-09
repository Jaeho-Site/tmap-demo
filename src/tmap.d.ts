// TMAP Web JS SDK v2 (Tmapv2) 최소 타입 선언 — 프로젝트에서 사용하는 부분만.
declare global {
  interface Window {
    Tmapv2?: typeof Tmapv2
  }

  namespace Tmapv2 {
    class LatLng {
      constructor(lat: number, lng: number)
      lat(): number
      lng(): number
    }

    interface MapOptions {
      center?: LatLng
      width?: string
      height?: string
      zoom?: number
      zoomControl?: boolean
      scrollwheel?: boolean
    }

    class Map {
      constructor(container: string | HTMLElement, options?: MapOptions)
      setCenter(latlng: LatLng): void
      setZoom(zoom: number): void
      getZoom(): number
      destroy(): void
    }

    interface MarkerOptions {
      position: LatLng
      map?: Map
      icon?: string
      iconSize?: Size
      title?: string
      label?: string
    }

    class Marker {
      constructor(options: MarkerOptions)
      setMap(map: Map | null): void
      addListener(event: string, handler: () => void): void
      getPosition(): LatLng
    }

    class Size {
      constructor(width: number, height: number)
    }

    interface InfoWindowOptions {
      position: LatLng
      content: string
      type?: number
      map?: Map
      border?: string
      offset?: unknown
    }

    class InfoWindow {
      constructor(options: InfoWindowOptions)
      setMap(map: Map | null): void
      setVisible(visible: boolean): void
    }

    interface PolylineOptions {
      path: LatLng[]
      strokeColor?: string
      strokeWeight?: number
      strokeOpacity?: number
      strokeStyle?: string
      map?: Map
    }

    class Polyline {
      constructor(options: PolylineOptions)
      setMap(map: Map | null): void
      addListener?(event: string, handler: () => void): void
    }
  }
}

export {}
