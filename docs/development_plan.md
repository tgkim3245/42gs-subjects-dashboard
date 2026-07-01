# [개발 계획서] 42 Intra Cadet Progress Dashboard Extension

## 1. 프로젝트 개요
* **프로젝트명:** 42-Progress-Tracker (가칭)
* **형태:** 순수 클라이언트 사이드 크롬 익스텐션 (Pure Client-side Chrome Extension)
* **목적:** 외부 서버 없이 브라우저 스토리지와 안전한 API 백오프(Back-off) 알고리즘을 활용하여, Circle 00~06 과제의 진행 현황을 행렬(Matrix) 구조로 시각화하고 정렬/필터링 기능 제공.

---

## 2. 핵심 아키텍처 및 안전장치 설계 (Rate Limit 우회)
외부 서버가 없기 때문에 브라우저 내부에서 '시간차 제어'와 '중복 요청 방지'를 완벽하게 구현해야 합니다.

### ① 토큰 버킷(Token Bucket) 및 큐(Queue) 기반 호출 엔진
* **안전장치:** 42 API의 제한이 초당 2회(2 req/s)라면, 익스텐션 내부 엔진은 안정성을 위해 **550ms~600ms당 1회** 호출하도록 `setTimeout` 또는 `Interval` 기반의 작업 큐(Job Queue)를 구동합니다.
* 연속적인 API 호출이 발생하더라도 큐에 쌓인 뒤 지정된 레이트로만 소비되므로 **429 Too Many Requests** 에러를 원천 차단합니다.

### ② chrome.storage.local 캐싱 전략 (가장 중요)
* **데이터 구조:** 스토리지에 유저별 과제 데이터와 함께 `last_updated` (타임스탬프)를 저장합니다.
* **유효기간(TTL) 설정:** 각 카뎃 데이터의 유효기간을 **1시간~3시간**으로 설정합니다.
* 대시보드를 열었을 때, 스토리지에 데이터가 있고 `현재 시간 - last_updated < TTL` 이라면 API를 호출하지 않고 스토리지 데이터로 즉시 렌더링합니다. 유효기간이 지난 카뎃만 큐에 등록하여 순차 갱신합니다.

### ③ 단계별(Lazy) 데이터 수집 알고리즘
* **1단계 (캠퍼스 유저 목록 캐싱):** 캠퍼스 전체 유저 ID/Login 리스트는 하루에 한 번만 `GET /v2/campus/:campus_id/users` 페이지네이션으로 긁어와 로컬 스토리지에 색인(Index)화합니다.
* **2단계 (화면 노출 중심 갱신):** 대시보드 진입 시 전체 카뎃을 한 번에 갱신하지 않고, 현재 페이지에 보이는 카뎃(예: Pagination 상의 10~20명)의 상세 정보(`projects_users`)부터 최우선으로 큐에 넣어 갱신합니다.

---

## 3. 핵심 기능 정의

### ① 대시보드 화면 (Dashboard View)
* **행(Row):** 카뎃 로그인 ID, 현재 레벨, 블랙홀 남은 날짜.
* **열(Column):** Circle 00 ~ Circle 06 주요 과제 (Libft, ft_printf, gnl, minitalk, push_swap, philosophers, minishell, cub3d/miniRT, ft_irc/Inception 등).
* **셀(Cell):** 과제 상태별 시각화
  * **통과:** 녹색 점수
  * **진행중:** 청색
  * **실패:** 적색
  * **미시작:** 회색 공백
* **기능:** 특정 과제 점수 순 정렬, 대시보드 내 ID 검색, 블랙홀 임박 순 정렬.

### ② 관심 카뎃(Bookmark) 기능
* 수천 명의 데이터를 한 번에 보기 부담스러울 때를 대비해, 원하는 카뎃만 필터링해서 볼 수 있는 '관심 카뎃 모아보기' 탭 제공.
* Intra 프로필 페이지에 익스텐션 스크립트로 **[대시보드 추가]** 버튼을 주입하여 유저가 직접 수동 추가 가능.

---

## 4. UI/UX 디자인 가이드라인
* **Intra 페이지 주입:** Intra 내부에 메뉴를 주입하거나 팝업창을 크게 활용.
* **가독성 최우선:** 데이터가 빽빽하므로 마우스 오버 시 행/열 하이라이트 필수.
* **프로그레스 바 제공:** 현재 API 큐가 가동 중일 때, 브라우저 상단이나 대시보드 하단에 `[데이터 동기화 중... (12/50 완료)]` 형태의 상태 바를 노출하여 사용자가 답답하지 않게 처리.

---

## 5. 컴포넌트 및 파일 구조 (Manifest V3 기준)
```
my-42-extension/
├── manifest.json         # 익스텐션 설정 파일 (V3 필수)
├── src/
│   ├── background/
│   │   └── worker.js     # API 요청 큐 관리, Rate Limit 제어, 알람 주기 가동
│   ├── content/
│   │   └── injector.js   # Intra 페이지 UI 주입 (버튼 추가 등)
│   └── popup/            # 대시보드 UI (React 또는 Vanilla JS)
│       ├── popup.html
│       ├── popup.js
│       └── table.css     # 가독성을 높인 줄바꿈 및 간격 스타일링
└── utils/
    └── api_client.js     # 안전장치(Delay)가 내장된 42 API 래퍼
```

---

## 6. 개발 로드맵 및 리스크 관리

> **현재 진행 단계: Phase 1 (UI 완성 중)**

### Phase 1 — UI 기능 완성 (목업 데이터 기반, 즉시 착수 가능)

| 항목 | 작업 내용 | 상태 |
| :--- | :--- | :--- |
| P1-1 | 검색 기능 JS 연결 (입력 즉시 필터링, 200ms debounce) | ✅ |
| P1-2 | ⭐ 관심 카뎃 탭 필터링 동작 구현 | ✅ |
| P1-3 | 설정 패널(⚙️) — 저장소 선택 옵션 및 파싱 옵션 구현 | ✅ |
| P1-4 | starred_cadets 저장 로직을 설정 연동으로 교체 | ✅ |
| P1-5 | 행 정렬 기능 구현 (Login ID, 레벨, 블랙홀 날짜 헤더 클릭 정렬) | ✅ |

---

### Phase 2 — API 연동 (선결: 42 Intra 앱 등록을 통한 UID/SECRET 획득)

| 항목 | 작업 내용 | 상태 |
| :--- | :--- | :--- |
| P2-1 | 설정 패널 — API UID / SECRET 입력창 추가 및 토큰 자동 발급 | ✅ |
| P2-2 | `api_client.js` 구현 (Rate Limit 큐 + Back-off 550ms) | ✅ |
| P2-3 | `worker.js` 큐 엔진 구현 (우선순위, Back-off, 큐 복원) | ✅ |
| P2-4 | `GET /v2/campus/69/users` 페이지네이션으로 users_index 수집 | ✅ |
| P2-5 | `GET /v2/users/:id/projects_users` 과제 상세 수집 및 Slim 저장 | ✅ |

---

### Phase 3 — 데이터 연동 (목업 → 실데이터 전환)

| 항목 | 작업 내용 | 상태 |
| :--- | :--- | :--- |
| P3-1 | 테이블 렌더링을 chrome.storage 데이터 기반으로 전환 | ✅ |
| P3-2 | 프로그레스 바 Queue 상태 실시간 연동 | ✅ |
| P3-3 | 툴팁 및 이벤트 위임 버그 수정 완료 (#1~#6) | ✅ |
| P3-4 | 예외 상황 테스트 (429 Back-off, 데이터 용량 최적화 완료) | ✅ |

---

### 잠재적 리스크 및 대응방안
* **리스크:** 카뎃 인원이 너무 많아 `chrome.storage.local` 용량 제한(기본 10MB)에 걸릴 위험.
* **대응방안:** `manifest.json`에 `"unlimitedStorage"` 권한을 명시하여 용량 제한을 해제하고, 과제 데이터 중 필요한 핵심 필드(`project_id`, `status`, `final_mark`, `updated_at`)만 가공하여 최소한의 용량으로 압축 저장.

