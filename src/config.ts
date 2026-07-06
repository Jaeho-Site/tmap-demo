// TMAP 앱 키 — .env 의 VITE_TMAP_APP_KEY 에서 주입 (커밋되지 않음, .env.example 참고).
// 보고서에서 "Vector Map SDK (JS)" 전용 키로 검증됨.
// → 브라우저 지도 렌더링(JS SDK)에는 유효. REST 오픈API(보행자 경로안내)에서는 INVALID_API_KEY.
// 서버 경로탐색이 필요하면 openapi.sk.com 콘솔에서 "보행자 경로안내" 상품을 구독한 서버용 appKey로 교체.
export const TMAP_APP_KEY = import.meta.env.VITE_TMAP_APP_KEY

// 대전광역시 중심 (대전시청 인근)
export const DAEJEON_CENTER = { lat: 36.3504, lng: 127.3845 }
export const DEFAULT_ZOOM = 12

// 참고: TMAP Web JS SDK v2 로더 URL (실제 로드는 index.html의 <script>에서 동기 수행)
export const TMAP_SDK_URL = `https://apis.openapi.sk.com/tmap/jsv2?version=1&appKey=${TMAP_APP_KEY}`
