// 대전 MVP 데이터풀 — 출처: API 검증 1·2차 보고서 + 대전 MVP 데이터풀 보고서
// 좌표가 원본에 없는 항목(국가소음·둘레산길·둘레길 코스)은 주소/장소명 기반 근사 좌표(approx=true)다.

export type PurposeId = 'safety' | 'nature' | 'quiet' | 'joint'

export interface Purpose {
  id: PurposeId
  label: string
  emoji: string
  color: string
  thickness: number // 1~4, 보고서 "풀 두께"
  verdict: string
}

// 4대 산책 목적 — 보고서 "목적별 데이터풀 규모"
export const PURPOSES: Purpose[] = [
  { id: 'safety', label: '방범 · 안전', emoji: '🛡️', color: '#2563eb', thickness: 4, verdict: '강점' },
  { id: 'nature', label: '자연친화', emoji: '🌳', color: '#16a34a', thickness: 3, verdict: '강점 (차별화)' },
  { id: 'joint', label: '관절보호', emoji: '🦵', color: '#d97706', thickness: 2, verdict: '보완 필요' },
  { id: 'quiet', label: '조용함', emoji: '🤫', color: '#7c3aed', thickness: 1, verdict: '최대 보완' },
]

export interface MapPoint {
  id: string
  purpose: PurposeId
  name: string
  lat: number
  lng: number
  approx: boolean // 근사 좌표 여부
  detail: string // 팝업 상세 (HTML 허용 안 함, 텍스트)
  metric?: string // 대표 수치 배지
}

// 🤫 조용함 — 국가소음 도로지점정보(대전 6지점). 원본에 좌표 없음 → 주소 지오코딩 근사.
// 야간 등가소음(Leq, dB). 보고서 [실측].
export const NOISE_POINTS: MapPoint[] = [
  { id: 'noise-1', purpose: 'quiet', name: '태평양화학 앞', lat: 36.3832, lng: 127.4085, approx: true, metric: '23.0 dB', detail: '대덕구 대화동 · 야간 등가소음 23.0 dB — 대전에서 가장 조용한 관측점' },
  { id: 'noise-2', purpose: 'quiet', name: '갤러리아백화점 앞', lat: 36.3281, lng: 127.4271, approx: true, metric: '33.8 dB', detail: '중구 대흥2동 · 야간 등가소음 33.8 dB' },
  { id: 'noise-3', purpose: 'quiet', name: '삼부아파트 앞', lat: 36.3248, lng: 127.3985, approx: true, metric: '35.8 dB', detail: '중구 태평동 · 야간 등가소음 35.8 dB' },
  { id: 'noise-4', purpose: 'quiet', name: '충남대부속병원 앞', lat: 36.3222, lng: 127.4192, approx: true, metric: '37.6 dB', detail: '중구 대사동 · 야간 등가소음 37.6 dB' },
  { id: 'noise-5', purpose: 'quiet', name: '호텔리베라 앞', lat: 36.3541, lng: 127.3412, approx: true, metric: '39.8 dB', detail: '유성구 봉명동 · 야간 등가소음 39.8 dB' },
  { id: 'noise-6', purpose: 'quiet', name: '한국타이어 앞', lat: 36.4518, lng: 127.4092, approx: true, metric: '48.4 dB', detail: '대덕구 목상동 · 야간 등가소음 48.4 dB — 가장 시끄러운 관측점' },
]

// 🌳 자연친화 — 대전둘레산길(국가숲길 지정, 2023). 12구간 총 약 138km.
// 보고서에 명시된 구간 + 대표 산 위치 근사 좌표. dist=구간거리(km).
export const TRAIL_POINTS: (MapPoint & { dist?: number })[] = [
  { id: 'trail-1', purpose: 'nature', name: '1구간 보문산길', lat: 36.2985, lng: 127.4185, approx: true, dist: 9.3, metric: '9.3 km', detail: '대전둘레산길 1구간 · 보문산 일대 · 약 9.3km' },
  { id: 'trail-6', purpose: 'nature', name: '6구간 계족산길', lat: 36.3985, lng: 127.4525, approx: true, dist: 13.5, metric: '13.5 km', detail: '대전둘레산길 6구간 · 계족산(황톳길) · 약 13.5km — 최장 구간' },
  { id: 'trail-10', purpose: 'nature', name: '10구간', lat: 36.3312, lng: 127.3125, approx: true, dist: 8.98, metric: '9.0 km', detail: '대전둘레산길 10구간 · 서부 능선 · 약 8.98km' },
  { id: 'trail-sikjang', purpose: 'nature', name: '식장산 구간', lat: 36.3208, lng: 127.4785, approx: true, metric: '598m', detail: '식장산(해발 598m) 일대 · 대전 동편 최고봉 능선 코스' },
  { id: 'trail-usan', purpose: 'nature', name: '우산봉 · 갑하산 구간', lat: 36.3735, lng: 127.2985, approx: true, metric: '574m', detail: '우산봉·갑하산 능선 · 유성 서북부 자연친화 코스' },
]

// 🦵 관절보호 — TMAP turnType 실증. 계룡로 육교(turnType 125) — 대전 실호출 검증 지점.
// 계단(turnType 127)은 TMAP이 반환하지 않음 → OSM highway=steps 등 보조 필요(보고서).
export const JOINT_POINTS: MapPoint[] = [
  { id: 'joint-1', purpose: 'joint', name: '계룡로 육교 (TMAP 실증)', lat: 36.35063567056, lng: 127.42160915252, approx: false, metric: 'turnType 125', detail: 'TMAP 보행자 경로안내에서 육교(turnType 125) 실제 반환이 검증된 지점 · 관절보호 모드 우회 가중치 대상' },
]

// 🛡️ 방범/안전 — 가로등·CCTV는 포인트 원본이 코드에 없음(데이터셋 43,082건 등).
// 지도에는 대표 통계 카드로 표현. 아래는 레이어 설명용 메타.
export interface DatasetInfo {
  purpose: PurposeId
  title: string
  scale: string
  note: string
  url: string
}

export const DATASETS: DatasetInfo[] = [
  { purpose: 'safety', title: '대전광역시 가로등 현황', scale: '43,082건 (위경도 포함)', note: '야간 조도 → 밤에 밝은 길 스코어링 1차 재료', url: 'https://www.data.go.kr/data/15110054/fileData.do' },
  { purpose: 'safety', title: '대전 방범용 CCTV (시+구 다층)', scale: '실시간 갱신 · 다수 데이터셋', note: '방범/차량방범/교통관제 + 서구·유성구 보강', url: 'https://www.data.go.kr/data/15109459/openapi.do' },
  { purpose: 'safety', title: '전국보행자전용도로 표준데이터(대전분)', scale: '보도폭·CCTV수·보안등수·보차분리', note: '한 데이터셋에서 방범+보도 지수 동시 산출 (활용신청 필요)', url: 'https://www.data.go.kr/data/15025443/standard.do' },
  { purpose: 'nature', title: '대전둘레산길 (국가숲길)', scale: '12구간 · 약 138km · GPX', note: '서울·부산은 국가숲길 0곳 → 대전 유일 차별화. POI API는 502 복구 대기', url: 'https://www.data.go.kr/data/15108060/openapi.do' },
  { purpose: 'quiet', title: '국가소음 도로지점정보(대전분)', scale: '6개 지점 (12행 · 좌표 없음)', note: '주소 지오코딩 필요 + 도로교통소음_격자(59394979)로 밀도 보강', url: 'https://www.data.go.kr/data/15147975/fileData.do' },
  { purpose: 'joint', title: 'TMAP turnType + 산길 경사', scale: '경로 단위 태깅 (계단은 공백)', note: '육교(125)·경사로(128) 태깅 가능. 계단(127)은 OSM highway=steps 보조 필요', url: 'https://skopenapi.readme.io/reference/보행자-경로안내' },
]

// 보행자 안전 통계 — 1차 PDF 인용
export const SAFETY_STATS = {
  pedestrianAccidentShare: 52, // 대전 사고의 52%가 보행자
  crossingShare: 55, // 55%가 교차로 횡단 중
}

// 모든 마커 포인트
export const ALL_POINTS: MapPoint[] = [
  ...NOISE_POINTS,
  ...TRAIL_POINTS,
  ...JOINT_POINTS,
]
