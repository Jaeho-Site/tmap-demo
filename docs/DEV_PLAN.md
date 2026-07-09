# 산책온 — 개발 계획 & TODO (프론트 우선 MVP)

> **문서 상태:** v1.0 · **작성일:** 2026-07-10
> **함께 볼 문서:** [PRD.md](../PRD.md), [USER_STORIES.md](../USER_STORIES.md), [UX_PRINCIPLES.md](../UX_PRINCIPLES.md), [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md), [SCREENS.md](./SCREENS.md)
> **목표:** 대전 한정 데이터 검증 MVP를, **모바일 우선 React 웹**으로 빠르게 데모 가능한 프로토타입까지 만든다.

---

## 0. 확정된 방향 (2026-07-10 결정)

| 항목 | 결정 | 함의 |
|---|---|---|
| **지도 엔진** | **TMAP JS SDK v2** | 지도 *렌더링*은 TMAP. 지도 페이지의 **UI/UX chrome(플로팅 컨트롤·바텀시트·날씨·현위치)는 네이버지도 스타일**로 입힌다. |
| **디자인 언어** | **AllTrails 스타일** | 다크 테마 + 라임그린 액센트, 알약형 버튼, 큰 라운드 카드, 하단 5탭. `public/images/AllTrails-*.jpg`가 레퍼런스. |
| **브랜드 폰트** | **나눔스퀘어 라운드** | 둥글둥글·친근. 로컬 embed(라이선스 안전). 폴백 Pretendard/system. |
| **컴포넌트 스타일** | **Tailwind + shadcn/ui 패턴(Radix)** | 깔끔한 박스/시트/칩. AllTrails 토큰으로 테마 오버라이드. |
| **범위** | **프론트 우선 프로토타입** | 추천·AI 회고는 룰기반/목업, 코스는 실제 대전 데이터, 기록은 localStorage. 백엔드는 이후 연결. |
| **지역** | **대전 유성구 축(갑천·유성천 일대)** 우선 | 콜드스타트에서 밀도 우선(PRD §8 1단계). |

---

## 1. 기술 스택 & 의존성

**유지:** React 19 + Vite 8 + TypeScript, 기존 대전 데이터(`src/data/*`), fetch 스크립트(`scripts/*`).

**추가 설치 예정:**
- `react-router-dom` — 화면 라우팅(스택 플로우 포함)
- `zustand` — 경량 전역 상태(조건·산책 세션·기록)
- `tailwindcss` + `@tailwindcss/vite` — 스타일 기반
- `shadcn/ui` 패턴용: `class-variance-authority`, `clsx`, `tailwind-merge`, `@radix-ui/*`(dialog·tabs·slider 등 필요 시)
- `lucide-react` — 아이콘(AllTrails가 쓰는 라인 아이콘 계열과 유사)
- (지도) TMAP는 `index.html` 스크립트 유지. 타입은 기존 `src/tmap.d.ts` 확장.

**폰트:** 나눔스퀘어 라운드 `.woff2`(R/B/EB) → `public/fonts/`에 배치, `@font-face`로 로드.

---

## 2. 목표 폴더 구조 (재구성)

```
src/
  app/            # 라우터, 프로바이더(AppShell 마운트)
  pages/          # 화면 단위 (홈/탐험/기록/저장/프로필 + 산책 루프 스택)
  components/
    ui/           # shadcn형 프리미티브 (Button, Card, Sheet, Chip, Badge, Tabs, Slider…)
    map/          # TmapMap + 네이버 스타일 컨트롤 chrome
    layout/       # AppShell, BottomTabBar
  features/
    recommend/    # 룰 기반 추천 엔진 + 이유 생성기(템플릿)
    walk/         # 산책 진행, GPS 추적/시뮬레이터, 수동종료
    feedback/     # 원탭 평가, 태그 시트, 암묵 신호
    retrospective/# AI 회고(목업/템플릿), 태그 추출(목업)
    history/      # 기록, 연속기록, 월간 리포트
    saved/        # 코스 저장/커스터마이즈, 탐험 도감
  data/           # 기존 대전 데이터(공원/가로수길/보행로/자전거도로) — 코스 후보 소스
  lib/            # geo(거리/근접), storage(localStorage), format, confidence(신뢰도)
  hooks/          # useTmapSdk(기존), useGeolocation, useWalkSession…
  styles/         # tokens.css, fonts.css, tailwind entry
  types/          # Course, WalkSession, Feedback, Retrospective…
```

**기존 TMAP 테스트 코드 처리:** `src/components/MapView.tsx`, `Sidebar.tsx`, `App.tsx`는 참고용으로 `src/_legacy/`에 이관 후 새 구조로 재작성. 데이터/스크립트/`useTmapSdk`는 재사용.

---

## 3. 데이터 모델 (프로토타입 타입 초안)

```ts
type Purpose = 'nature' | 'safety' | 'quiet' | 'joint';   // 🌳🛡️🤫🦵
type Difficulty = 'easy' | 'moderate' | 'hard';
type ConfidenceLevel = 'verified' | 'estimated' | 'low';  // 신뢰도 표시(PRD §7, UX P7)

interface Waypoint { lat: number; lng: number; label?: string; kind: 'start'|'via'|'turn'|'end'; }
interface Course {
  id: string; name: string; area: string;               // 예: 유성구
  distanceKm: number; estMinutes: number; difficulty: Difficulty;
  purposes: Purpose[]; path: {lat:number;lng:number}[];  // 폴리라인(기존 route 데이터)
  waypoints: Waypoint[]; thumbnail?: string;             // r1~r6 등
  confidence: Record<Purpose, ConfidenceLevel>;          // 목적별 정직한 신뢰도
  reason?: string;                                       // 생성된 자연어 이유
}
interface WalkSession { courseId: string; startedAt; endedAt?; track: {lat;lng;t}[]; notes: string[]; pins: Pin[]; completed: boolean; }
interface Feedback { sessionId: string; rating: 'up'|'down'; tags: string[]; photo?: string; text?: string; }
interface Retrospective { sessionId: string; summary: string; extractedTags: string[]; }
```

---

## 4. 단계별 TODO (우선순위 = PRD P0 → P1)

체크박스는 구현 순서. 각 단계 끝의 **DoD(완료 정의)**를 만족하면 다음으로.

### Phase 0 — 기반 셋업
- [ ] Tailwind + shadcn 패턴 초기화, `tokens.css`(AllTrails 팔레트) 작성 → [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)
- [ ] 나눔스퀘어 라운드 `@font-face` 등록 + 전역 적용
- [ ] `react-router-dom` 라우팅 뼈대 + `AppShell` + `BottomTabBar`(홈·탐험·기록·저장·프로필)
- [ ] shadcn형 프리미티브 1차: `Button`(pill/primary/secondary), `Card`, `Chip`, `Sheet`(바텀시트), `Badge`
- [ ] 기존 TMAP 코드 `_legacy` 이관, 데이터/훅 재배치
- **DoD:** 빈 5개 탭 화면이 다크 테마 + 라운드 폰트로 뜨고, 하단 탭 이동이 동작한다.

### Phase 1 — 지도 & 위치 기반  ·  US-1.1  ✅ 완료
- [x] `TmapMap` 컴포넌트(기존 `useTmapSdk` 재사용) — 대전 중심, 반응형 풀스크린, 선택 하이라이트/현위치 마커, imperative 줌/팬 핸들
- [x] **네이버 스타일 지도 chrome**: 우측 플로팅 원형 컨트롤(레이어·줌·현위치), 좌상단 날씨 위젯(목업), 하단 주변코스 패널, 상단 검색바 + 목적 칩
- [x] 코스 카탈로그(`features/recommend/courses.ts`) — 실제 TMAP 검증 route(보행로 200 + 가로수길)에서 Course 생성, 폴리라인 렌더링(목적별 색)
- [x] `useGeolocation`: 권한 → 현위치 + 정확도, 실패 시 대전 중심 폴백
- **DoD:** ✅ 지도에 대전 코스가 그려지고, 현위치/줌/목적 필터/주변 코스 선택이 동작(스크린샷 검증).
- **알려진 한계:** TMAP 기본(밝은) 타일 + 다크 chrome(C2). 120개 상한을 거리 내림차순으로 잘라 자연친화(가로수길) 코스가 다수 — Phase 2 추천 엔진에서 목적 균형 처리. 번들에 route 좌표가 임베드되어 큼 → 이후 서버 이전.

### Phase 2 — 추천 루프  ·  US-1.2~1.4, US-2.1~2.4  (P0)  ✅ 완료
- [x] **홈 화면**: 대표 추천 카드 하나(엔진 연결) + 목적 빠른칩 + 조건 진입, 무입력 기본값
- [x] **조건 시트**: 시간(10/20/30/40)·난이도·목적 칩(🌳🛡️🤫🦵), 전부 선택적, 초기화
- [x] **추천 엔진(룰 기반)** `features/recommend/engine.ts`: 근접성·목적·시간·난이도·신뢰도 스코어링 → 정렬
- [x] **이유 생성기** `reason.ts`: 실제 속성만 참조, 얇은 데이터 목적엔 정직 유의점(UX P7)
- [x] **"다른 코스 보기"** 순환 + view/skip/start 암묵 신호(`features/feedback/signals.ts`)
- [x] **추천 상세** `/course/:id`: 지도(코스 하이라이트), 거리/시간, 목적+신뢰도 배지, 핵심 지점, 산책 시작
- **DoD:** ✅ 홈에서 이유 붙은 대표 코스 1개 → 상세에서 경로·신뢰도 확인 → 산책 시작(스크린샷 검증). 조건 스토어는 zustand로 전 화면 공유.

### Phase 3 — 산책 진행  ·  US-3.1~3.3  (P0)  ✅ 완료
- [x] **산책 중 화면** `WalkPage`: 핵심 지점(다음 지점 칩), 지도 위 현위치, 상단 타이머/거리
- [x] GPS watch + **허용 반경(35m)/이탈(45m) 감지**, **항상 보이는 수동 "산책 종료"**
- [x] **GPS 시뮬레이터**(시뮬 걷기 토글): 실기기 없이 경로 따라 진행·완주
- [x] 비모달 **한 줄 메모**(칩으로 누적)
- [x] 이탈 자동 질문 배너("길 막힘/없음?", dismissable, US-3.5)
- [x] 완주/종료 → `WalkRecord` localStorage 저장(`features/history/records.ts`) + complete/abandon 암묵 신호
- [x] **완료 화면 스텁** `/complete/:recordId`: 거리·시간·칼로리·메모 요약(Phase 4에서 피드백/회고 연결)
- [ ] (P1 이월) **핀 신고**("여기 문제") 시트 — Phase 4/후속
- **DoD:** ✅ 상세 → 산책 시작 → (시뮬)진행·완주/수동종료 → 기록 저장 → 완료 요약까지 동작(스크린샷 검증, localStorage 확인).

### Phase 4 — 피드백 & 회고  ·  US-4.1~4.2, US-5.1~5.3  (P0)  ✅ 완료
- [x] **완주 즉시 원탭 👍/👎** → **태그 시트**(🚧🔇🚫🌑⚠️ + 직접입력), 건너뛰기 가능(`tags.ts`)
- [x] **암묵 신호 수집**(view/skip/start/complete/abandon) → localStorage(Phase 2·3에서 연결)
- [x] **AI 회고(목업/템플릿)** `retrospective/generate.ts`: 기록·메모·평가만으로 따뜻한 요약(지어낸 사건 금지, 메모 인용)
- [x] **코스 품질 반영** `quality.ts`: 문제 태그 누적(1건=의심/3건+=확정), 추천 상세에 **주의 배너** 노출(E7/US-7.2)
- **DoD:** ✅ 완주 → 👍/👎 → 태그 → 회고까지 이어지고, 회고가 실제 데이터에 근거. 문제 태그가 다음 추천 상세에 주의로 되돌아옴(데이터 검증 루프 완성, 스크린샷 검증).

### Phase 5 — 리텐션  ·  US-6.1~6.4  (P0/P1)  ✅ 완료(P0)
- [x] **자동 기록**(거리/시간/칼로리) + **히스토리** 화면(실데이터, 산책 카드 → 회고 재열람)
- [x] **연속기록 & 월간 리포트**(`stats.ts`: 연속 일수·이번 달 거리/횟수·누적)
- [x] **코스 저장**(`store/saved.ts`) — 상세 하트 토글, **저장 탭** 목록(AllTrails Saved 톤)
- [x] **프로필**(게스트 모드, 누적 통계, 로그북/저장 진입)
- [x] **대전 탐험 도감**(P1): 탐험 탭 [지도|도감] 토글, 전체/구별 정복 %, 배지 6종(기록 기반 언락), 경로 도감(희귀도·수집/미개봉) → 미검증 경로로 유도(`features/explore/collection.ts`)
- [ ] (P1 이월) 코스 명명/커스터마이즈, 설정 화면, 산책 중 핀 신고
- **DoD:** ✅ 산책 자동 기록 → 히스토리·연속기록·월간 리포트·저장 코스·프로필 통계가 유지됨(스크린샷 검증).

### Phase 6 — 신뢰도 · 정직 마감  ·  US-7.1~7.2  (P0)
- [ ] `lib/confidence`: 1건=의심 / 3건+=확정 룰, 얇은 데이터 목적(조용함/관절) 정직 표시 전역 적용
- [ ] 카피 감수(UX §4 보이스) — 과대 마케팅 제거
- **DoD:** 얇은 데이터 목적에 신뢰도 배지가 일관되게 노출된다.

### Phase 7 — 백엔드 연동 준비  (이후, 프로토타입 이후)
- [ ] API 계약 정의(추천/기록/피드백/회고) — 목업 자리에 인터페이스 고정
- [ ] LLM 연동(회고·이유·태그 추출)로 목업 대체
- [ ] TMAP **서버 보행자 경로안내** 키 연동으로 실경로 검증 대체
- [ ] 어드민(코스 큐레이션/AI 검토/통계) — 별도 트랙

---

## 5. ⚠️ 제약 & 불가능/한계 사항 (반드시 인지)

| # | 항목 | 현재 상태 | 프로토타입 대응 | 실서비스에 필요한 것 |
|---|---|---|---|---|
| C1 | **TMAP 보행자 경로안내(REST)** | 현재 키 **INVALID**(JS SDK 렌더링용만 유효) | 사전 수집한 route 데이터 + JS SDK 폴리라인으로 코스 구성, 거리/시간은 데이터 기반 | openapi.sk.com에서 **"보행자 경로안내" 상품 구독한 서버용 appKey** |
| C2 | **지도 타일 스타일** | TMAP 기본 타일은 네이버 다크와 다름 | **UI chrome만 네이버 스타일**, 타일은 TMAP 기본(필요시 CSS 다크 필터 실험) | TMAP가 커스텀 다크 타일 미지원 시 시각 100% 일치는 불가 — chrome로 근접 |
| C3 | **AI 기능(이유·회고·태그 추출)** | LLM 미연동 | 룰/템플릿 목업. 인터페이스는 실 API와 동일하게 설계 | **LLM API 키** + 키 보호용 프록시/백엔드 |
| C4 | **GPS 산책 진행** | 브라우저 geolocation은 HTTPS·실기기 필요 | **GPS 시뮬레이터** 모드로 개발/데모, 실기기는 HTTPS(예: Vite `--host` + 인증서/터널) | 실단말 QA, 정확도 예외 처리 |
| C5 | **데이터 공백** | 조용함(소음 6지점·좌표 없음), 관절(계단 데이터 없음) | **정직한 신뢰도 표시**로 처리(과대 마케팅 금지, UX P7) | 소음 격자 데이터, OSM `steps`/`incline` 보조 데이터 |
| C6 | **인증** | 없음 | 게스트 + localStorage | 실 로그인(소셜/이메일) — 이후 |
| C7 | **코스 썸네일 사진** | `r1~r6`(6장)뿐, 코스별 실사진 부족 | 플레이스홀더/재사용 전략, 그라디언트 카드 폴백 | 코스별 실제 사진 수급 |

---

## 6. 진행 전 확인/수급이 필요한 것 (사용자에게)

- **필수는 없음** — 위 결정만으로 프로토타입은 전부 진행 가능(목업 기반).
- **있으면 더 진짜에 가까워지는 것(선택):**
  - [ ] TMAP **서버용 appKey**(보행자 경로안내 구독) → C1 실경로 검증
  - [ ] **LLM API 키**(예: Claude) → C3 실제 회고/이유 생성 (Phase 7)
  - [ ] 나눔스퀘어 라운드 `.woff2` 파일(없으면 공식 배포본으로 내가 세팅)
  - [ ] 유성구 내 **정확한 시범 소지역**(갑천 축 vs 유성천 축) 확정 — PRD §11 미해결 질문
- **엔진을 TMAP로 정했으므로 네이버 NCP 키는 불필요.**

---

## 7. 다음 액션

승인 시 **Phase 0(기반 셋업)**부터 착수합니다: Tailwind+shadcn+폰트+라우팅+빈 5탭 셸 → 이후 Phase 1 지도.
