# 호출 큐 및 백오프(Back-off) 알고리즘 설계서

> **문서 버전:** v0.1 (초안)
> **최종 수정일:** 2026-07-01
> **작성자:** -

---

## 1. 개요

이 문서는 42 API의 Rate Limit(초당 2회)을 초과하지 않으면서, 대용량 카뎃 데이터를 안전하고 효율적으로 수집하기 위한 **API 호출 큐(Queue) 엔진** 및 **Exponential Back-off 알고리즘**을 설계합니다.

**핵심 원칙:**
- 연속 API 호출 간격: **최소 550ms**
- 429 오류 발생 시: **Exponential Back-off로 자동 재시도**
- 화면에 보이는 카뎃의 데이터를 **최우선(Priority) 처리**

---

## 2. 큐 엔진 전체 아키텍처

```
[Popup / Content Script]          [Background Service Worker]
        │                                   │
        │ ── sendMessage("enqueue") ──▶     │
        │                             [Job Queue (배열)]
        │                              ├── Priority: HIGH  (현재 화면 카뎃)
        │                              └── Priority: NORMAL (나머지 카뎃)
        │                                   │
        │                             [Queue Runner]
        │                              setInterval(550ms)
        │                                   │
        │                             Rate Limit 체크
        │                              └── 토큰 버킷(Token Bucket)
        │                                   │
        │                             API 호출
        │                                   │
        │                              ├── 200 OK → chrome.storage.local 저장
        │                              │           → sendMessage("updated")
        │                              ├── 429    → Back-off 대기 후 재시도
        │                              └── 기타 오류 → 재시도 횟수 초과 시 에러 기록
        │                                   │
        │ ◀── sendMessage("updated") ──     │
   UI 재렌더링
```

> [!IMPORTANT]
> **UI 생명주기(Lifecycle) 독립성:**
> 실제 API를 요청하고 대기열을 소비하는 큐 엔진(`Queue Runner`)은 화면단(Iframe 모달)이 아닌 **백그라운드 서비스 워커(`worker.js`)**에서 구동됩니다.
> 따라서 사용자가 대시보드 모달창을 닫거나(`display: none` 또는 iframe 삭제), 인트라넷 탭을 새로고침하거나 다른 탭으로 이동하더라도 **백그라운드에서 진행 중이던 데이터 동기화 로딩 작업은 멈추지 않고 완료될 때까지 계속 수행**됩니다. 수집된 데이터는 `chrome.storage.local`에 실시간 캐싱되어 다음 대시보드를 열 때 즉각 노출됩니다.

---

## 3. Job(작업) 데이터 구조

큐에 들어가는 각 작업(Job) 단위입니다.

```javascript
{
  id: "job_jdoe_1751378400000",   // 중복 방지용 고유 ID (login + timestamp)
  type: "FETCH_USER_DETAIL",       // 작업 타입 (FETCH_USER_DETAIL | FETCH_USER_INDEX)
  login: "jdoe",                   // 대상 카뎃 login
  user_id: 12345,                  // 대상 카뎃 ID
  priority: "HIGH",                // HIGH(현재 화면) | NORMAL(나머지)
  retries: 0,                      // 현재 재시도 횟수
  max_retries: 3,                  // 최대 재시도 횟수
  created_at: 1751378400000        // 작업 생성 시각
}
```

---

## 4. 큐 우선순위 규칙

| 조건 | Priority | 처리 순서 |
| :--- | :--- | :--- |
| 현재 대시보드에 보이는 카뎃 (Pagination 현재 페이지) | `HIGH` | 먼저 처리 |
| 북마크(관심 카뎃)로 등록된 카뎃 | `HIGH` | 먼저 처리 |
| 그 외 캠퍼스 전체 카뎃 | `NORMAL` | 나중에 처리 |
| 캠퍼스 유저 목록 색인 갱신 | `NORMAL` | 가장 나중에 처리 (하루 1회) |

---

## 5. 토큰 버킷 기반 Rate Limit 제어

### 5-1. 간격 설정

```
42 API 공식 제한: 2 req/s (= 500ms당 1회)
익스텐션 안전 마진: 550ms당 1회 (약 1.81 req/s)
```

**잉여 10% 버퍼**를 두어 네트워크 지연이나 처리 오버헤드로 인한 초과를 방지합니다.

### 5-2. setInterval 기반 Queue Runner

```javascript
// 개념 코드 (실제 구현 시 참고용)
const INTERVAL_MS = 550;
let isRunning = false;

function startQueueRunner() {
  if (isRunning) return;
  isRunning = true;

  setInterval(() => {
    if (jobQueue.length === 0) return;

    // 우선순위 높은 작업 먼저 꺼냄
    const job = dequeueHighestPriority();

    executeJob(job)
      .then(result => {
        saveToStorage(job.login, result);
        notifyPopup(job.login);
      })
      .catch(err => handleJobError(job, err));

  }, INTERVAL_MS);
}
```

---

## 6. Exponential Back-off 알고리즘

### 6-1. 적용 조건

| 오류 코드 | 대응 |
| :--- | :--- |
| `429 Too Many Requests` | Back-off 후 재시도 |
| `503 Service Unavailable` | Back-off 후 재시도 |
| `500 Internal Server Error` | Back-off 후 재시도 |
| `401 Unauthorized` | Token 갱신 후 재시도 |
| `404 Not Found` | 재시도 없이 Job 폐기 |

### 6-2. 대기 시간 계산 공식

```
대기 시간 = BASE_DELAY × (2 ^ retries) + jitter

BASE_DELAY = 1000ms (1초)
jitter      = 0 ~ 500ms 무작위값 (동시 재시도 충돌 방지)
max_retries = 3회

재시도 횟수별 대기 시간:
  1회: 1000 × 2^1 + jitter = ~2000~2500ms
  2회: 1000 × 2^2 + jitter = ~4000~4500ms
  3회: 1000 × 2^3 + jitter = ~8000~8500ms
  초과: Job 폐기 → 에러 상태로 chrome.storage에 기록
```

### 6-3. 흐름도

```
API 호출 실패 (429 / 503 / 500)
    │
    ▼
job.retries < job.max_retries?
    │ YES
    ▼
backoff_delay = BASE_DELAY × 2^retries + random(0, 500)
job.retries += 1
setTimeout(재큐 삽입, backoff_delay)

   ── Queue Runner 정지 여부 ──
   429 발생 시: Queue Runner를 일시 정지(pause)하고
               Retry-After 헤더 값(초)만큼 대기 후 재개.
               (Retry-After 헤더가 없으면 backoff_delay 사용)

    │ NO (max_retries 초과)
    ▼
chrome.storage에 에러 상태 기록:
  { login: "jdoe", error: "MAX_RETRY_EXCEEDED", timestamp: ... }
팝업 UI에 ⚠️ 아이콘 표시
```

---

## 7. Queue Runner 상태 머신

```
         ┌──────────────────────────────────────────┐
         │                                          │
    [IDLE]                                          │
      │  큐에 작업 추가됨                          │
      ▼                                             │
   [RUNNING]                                        │
      │  setInterval(550ms)                         │
      │  큐 비어있음                                │
      │ ──────────────────────▶ [IDLE]              │
      │                                             │
      │  429 감지                                   │
      ▼                                             │
   [PAUSED]                                         │
      │  Retry-After 대기 완료                      │
      └──────────────────────────────────────────▶  │
                     [RUNNING] (재개)               │
                          │                         │
                     (루프 반복)─────────────────────┘
```

---

## 8. 진행 상태 UI와의 연동

Background Worker는 큐 상태가 바뀔 때마다 Popup에 메시지를 전송합니다.

```javascript
// Background → Popup 메시지 구조
{
  type: "QUEUE_STATUS",
  payload: {
    state: "RUNNING",        // IDLE | RUNNING | PAUSED
    total: 50,               // 전체 작업 수
    completed: 12,           // 완료 작업 수
    current_login: "jdoe"    // 현재 처리 중인 카뎃
  }
}
```

팝업 UI는 이 메시지를 수신하여 **프로그레스 바**를 업데이트합니다.

```
[데이터 동기화 중...] ████████░░░░░░░░░░░░ 12 / 50
```

---

## 9. 중복 작업 방지 (Deduplication)

동일한 카뎃에 대한 작업이 중복으로 큐에 들어오는 것을 막습니다.

```javascript
// 큐 삽입 전 체크
function enqueue(job) {
  const isDuplicate = jobQueue.some(j => j.login === job.login && j.type === job.type);
  if (isDuplicate) return; // 무시
  jobQueue.push(job);
}
```

---

## 10. 열린 질문 (Open Questions) 및 의사 결정 내역

| # | 질문 | 상태 / 결정 내역 |
| :--- | :--- | :--- |
| **Q1** | 42 API의 `429` 응답에 `Retry-After` 헤더가 포함되는가? | **[확인 필요]** 실제 API 연동 시 응답 헤더를 디버깅하여 처리하되, 기본적으로 `Retry-After`가 있으면 해당 시간만큼 지연시키고 없으면 지수 백오프 대기(2초, 4초, 8초...)를 수행하도록 설계함. |
| **Q2** | Background Service Worker는 브라우저 종료나 비활성화 시 소멸한다. 앱 재시작 후 미완료 큐를 `chrome.storage`에서 복원할 것인가? | **[결정]** 네. 전체 수집(300~500명) 도중 중단되는 것을 방지하기 위해, 작업 큐 배열을 `chrome.storage.local`에 수시로 백업하여 브라우저 재시작이나 서비스 워커 부활 시 남은 지점부터 복구되도록 설계함. |
| **Q3** | 카뎃 수가 많으면 전체 갱신에 오랜 시간이 걸리는데 어떻게 처리할 것인가? | **[결정]** 하이브리드(Hybrid) 동기화 전략을 적용함. 대시보드를 켜면 현재 속한 페이지의 카뎃 20명을 우선순위 `HIGH`로 큐의 맨 앞에 넣어 즉시 갱신하고, 나머지 전체 카뎃은 `NORMAL` 우선순위로 백그라운드에서 백오프 제약을 준수하며 천천히 동기화함. |

