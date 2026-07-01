# API 및 로컬 스토리지 데이터 스키마 명세서

> **문서 버전:** v0.2 (확정 반영)
> **최종 수정일:** 2026-07-01
> **작성자:** -

---

## 1. 개요

이 문서는 42 API에서 수집하는 데이터의 Endpoint, 필수 응답 필드, 그리고
`chrome.storage.local`에 저장하는 로컬 스토리지 JSON 스키마를 정의합니다.

외부 서버 없이 브라우저 스토리지만 사용하므로, **최소한의 필드만 추출·저장**하여
10MB 기본 한도를 초과하지 않도록 설계합니다.
(`unlimitedStorage` 권한을 선언하되, 데이터 최소화를 원칙으로 합니다.)

---

## 2. 42 API Endpoint 목록

### 2-1. 캠퍼스 유저 목록 (색인용)

| 항목 | 내용 |
| :--- | :--- |
| **Method** | `GET` |
| **Endpoint** | `/v2/campus/:campus_id/users` |
| **호출 주기** | 하루 1회 (Alarm 기반) |
| **Pagination** | `page[size]=100`, `page[number]=N` 반복 |
| **목적** | 전체 카뎃 ID / Login / 블랙홀 날짜 색인 구축 |

**추출할 필드 (응답 중 필수 필드만)**

```json
{
  "id": 12345,
  "login": "jdoe",
  "cursus_users": [
    {
      "cursus_id": 21,
      "level": 5.42,
      "blackholed_at": "2026-12-01T00:00:00.000Z",
      "begin_at": "2024-03-04T00:00:00.000Z"
    }
  ]
}
```

> [!NOTE]
> `cursus_id: 21` 이 42Cursus 본과정입니다. Piscine(cursus_id: 9) 데이터는 필터링합니다.

---

### 2-2. 유저별 과제 진행 현황

| 항목 | 내용 |
| :--- | :--- |
| **Method** | `GET` |
| **Endpoint** | `/v2/users/:user_id/projects_users` |
| **호출 주기** | TTL(1~3시간) 만료 시 순차 갱신 |
| **목적** | Circle 00~06 핵심 과제의 상태 및 점수 수집 |

**추출할 필드**

```json
{
  "project": {
    "id": 1314,
    "name": "Libft",
    "slug": "libft"
  },
  "status": "finished",
  "final_mark": 115,
  "validated?": true,
  "updated_at": "2025-11-02T14:23:10.000Z"
}
```

**`status` 가능 값**

| 값 | 의미 | 대시보드 표시 |
| :--- | :--- | :--- |
| `finished` + `validated?: true` | 통과 | 🟢 녹색 점수 |
| `finished` + `validated?: false` | 실패 | 🔴 적색 F |
| `in_progress` | 진행 중 | 🔵 청색 점 |
| (데이터 없음) | 미시작 | ⬜ 회색 공백 |

---

### 2-3. 대상 과제 목록 (21열 확정 구조)

현재 UI 기준으로 과제 열 구조를 확정합니다. Circle별 열 인덱스 및 Slug 매핑입니다.

> [!IMPORTANT]
> Project Slug는 캠퍼스마다 다를 수 있습니다. 실제 API 응답 확인 후 `slug` 필드 검증이 필요합니다.

| Col | Circle | 과제명 | 선택형 | 예상 Slug |
| :--- | :--- | :--- | :--- | :--- |
| 1 | C0 | Libft | 단독 | `libft` |
| 2 | C1 | ft_printf | 단독 | `ft_printf` |
| 3 | C1 | get_next_line | 단독 | `get-next-line` |
| 4 | C1 | Born2beroot | 단독 | `born2beroot` |
| 5 | C2 | push_swap | 단독 | `push_swap` |
| 6 | C2 | minitalk / pipex | **선택 (OR)** | `minitalk`, `pipex` |
| 7 | C2 | so_long / fract-ol / FdF | **선택 (OR)** | `so_long`, `fract-ol`, `fdf` |
| 8 | C2 | Exam Rank 02 | 단독 | `exam-rank-02` |
| 9 | C3 | minishell | 단독 | `minishell` |
| 10 | C3 | philosophers | 단독 | `philosophers` |
| 11 | C3 | Exam Rank 03 | 단독 | `exam-rank-03` |
| 12 | C4 | cub3d / miniRT | **선택 (OR)** | `cub3d`, `miniRT` |
| 13 | C4 | NetPractice | 단독 | `netpractice` |
| 14 | C4 | CPP Modules 00-04 | **묶음 (AND 5개)** | `cpp-module-00` ~ `cpp-module-04` |
| 15 | C4 | Exam Rank 04 | 단독 | `exam-rank-04` |
| 16 | C5 | Inception | 단독 | `inception` |
| 17 | C5 | ft_irc / webserv | **선택 (OR)** | `ft_irc`, `webserv` |
| 18 | C5 | CPP Modules 05-09 | **묶음 (AND 5개)** | `cpp-module-05` ~ `cpp-module-09` |
| 19 | C5 | Exam Rank 05 | 단독 | `exam-rank-05` |
| 20 | C6 | ft_transcendence | 단독 | `ft_transcendence` |
| 21 | C6 | Exam Rank 06 | 단독 | `exam-rank-06` |

---

## 3. chrome.storage.local 스키마 정의

### 3-1. 스토리지 키 구조 요약

```
chrome.storage.local
├── meta
│   ├── campus_id             # 현재 캠퍼스 ID
│   ├── users_index_updated   # 유저 목록 색인 최종 갱신 타임스탬프
│   ├── ttl_hours             # 카뎃 상세 데이터 TTL (기본값: 2)
│   └── storage_backend       # 관심 카뎃 저장 위치: "chrome" | "local"
├── users_index               # 전체 유저 기본 정보 배열
├── users_detail              # 유저별 과제 상세 데이터 (키: login)
│   └── { login }
│       ├── last_updated
│       └── projects
└── starred_cadets            # 관심 카뎃 login ID 배열 (설정에 따라 localStorage에도 저장)
```

---

### 3-2. `meta` 객체

```json
{
  "campus_id": 55,
  "users_index_updated": 1751378400000,
  "ttl_hours": 2,
  "storage_backend": "chrome"
}
```

> [!NOTE]
> `campus_id`는 **42 Gyeongsan(경산) 캠퍼스 고정값 `55`**로 하드코딩합니다. 설정 입력 불필요.

---

### 3-3. `users_index` 배열

캠퍼스 전체 유저 기본 정보. 하루 1회 갱신.

```json
[
  {
    "id": 12345,
    "login": "jdoe",
    "level": 5.42,
    "blackholed_at": "2026-12-01T00:00:00.000Z",
    "begin_at": "2024-03-04T00:00:00.000Z"
  },
  ...
]
```

**용량 추정 (카뎃 1,000명 기준):**
- 필드당 약 60bytes × 1,000명 ≈ **약 60KB**

---

### 3-4. `users_detail` 객체

유저별 과제 상세 정보. TTL 기반 순차 갱신.

```json
{
  "jdoe": {
    "last_updated": 1751378400000,
    "projects": {
      "libft":          { "status": "finished", "validated": true,  "mark": 115, "updated_at": "2025-11-02T14:23:10.000Z" },
      "ft_printf":      { "status": "finished", "validated": true,  "mark": 100, "updated_at": "2025-12-01T09:10:00.000Z" },
      "get-next-line":  { "status": "in_progress", "validated": false, "mark": null, "updated_at": "2026-01-15T11:00:00.000Z" },
      "push_swap":      { "status": null, "validated": false, "mark": null, "updated_at": null },
      "minitalk":       { "status": null, "validated": false, "mark": null, "updated_at": null },
      "philosophers":   { "status": null, "validated": false, "mark": null, "updated_at": null },
      "minishell":      { "status": null, "validated": false, "mark": null, "updated_at": null },
      "cub3d":          { "status": null, "validated": false, "mark": null, "updated_at": null },
      "ft_irc":         { "status": null, "validated": false, "mark": null, "updated_at": null },
      "inception":      { "status": null, "validated": false, "mark": null, "updated_at": null }
    }
  }
}
```

**용량 추정 (카뎃 1,000명, 과제 12개 기준):**
- 과제당 약 80bytes × 12 × 1,000명 ≈ **약 960KB**
- 전체 합산 ≈ **약 1MB 이내** (unlimitedStorage 없이도 여유 있음)

---

## 4. 캐싱 및 API 요청 최소화 전략

외부 서버 없이 API 제한을 준수해야 하므로, 불필요한 API 요청을 원천 차단하는 이중 캐싱 필터링을 구현합니다.

### 4-1. 이중 필터링 알고리즘
1. **1단계 (기수/색인 캐시):** 하루 1회만 캠퍼스 전체 유저 색인(`users_index`)을 수집합니다.
2. **2단계 (레벨 변동 검사 - 핵심 최적화):**
   * 색인이 갱신되었을 때, 기존 저장된 유저의 `level` 및 `blackholed_at` 값을 새로운 색인 정보와 대조합니다.
   * **두 값이 모두 일치하고 이미 상세 데이터(`users_detail`)가 있다면, 해당 카뎃은 새로운 과제를 통과하지 않은 것이므로 상세 정보 API 요청을 완전히 건너뜁니다 (API 요청 90% 이상 절감).**
3. **3단계 (시간 기반 TTL 캐시):** 화면에 노출되는 카뎃 중 레벨 변동이 발생한 카뎃에 한해서만 `last_updated`와 현재 시간의 차이를 비교해 TTL(예: 2시간)이 지났을 경우에만 API 상세 수집 큐에 등록합니다.
4. **4단계 (졸업/블랙홀 동결 캐시):** 이미 본과정을 졸업했거나(Lv 21 이상 또는 transcendence 통과), 블랙홀 만료일이 완전히 지나 제적 처리된 카뎃은 상태 변동이 없으므로 영구적으로 동기화 대상에서 제외(동결)합니다.

### 4-2. 캐싱 흐름 요약

```
대시보드 진입
    │
    ▼
[users_index] 존재 && (현재시간 - users_index_updated) < 24h ?
    │ YES → 색인 즉시 사용
    │ NO  → /v2/campus/:id/users 페이지네이션 호출 후 색인 갱신 (하루 1회)
    │
    ▼
현재 화면에 보이는 카뎃 목록 파악 (Pagination 기준 최대 20명)
    │
    ▼
해당 카뎃이 '동결(졸업/제적)' 상태인가?
    │ YES → API 요청 생략 (스토리지 데이터 사용)
    │ NO
    ▼
[users_detail]에 존재 && (현재 색인 level == 캐시 level) && (현재 색인 blackhole == 캐시 blackhole) ?
    │ YES → API 요청 생략 (과제 변동 없음으로 판단, 스토리지 데이터 사용)
    │ NO (레벨/블랙홀 변동 있음)
    ▼
(현재시간 - last_updated) < TTL ?
    │ YES → API 요청 생략 (스토리지 데이터 사용)
    │ NO  → API 큐(HIGH)에 등록 → 순차 갱신 후 저장 및 렌더링
    ▼
완료
```

---

## 5. 열린 질문 (Open Questions)

| # | 질문 | 상태 |
| :--- | :--- | :--- |
| Q1 | 캠퍼스 ID(campus_id)는 설정 화면에서 사용자가 직접 입력하는가, 아니면 자동 감지인가? | ✅ **[결정]** 42 Gyeongsan 캠퍼스 고정값 `55`로 하드코딩. 설정 불필요. |
| Q2 | 선택과제(OR) 셀에서 두 과제 중 하나만 선택 가능한데, 어떻게 단일 셀에 표현할 것인가? | ✅ **[결정]** choice-sub 구조로 두 과제 모두 표시하고, 통과한 과제만 강조. |
| Q3 | CPP Module 묶음(14열, 18열)은 몇 개 이상 통과 시 "통과" 셀로 표시하는가? | ✅ **[결정]** **전부 통과해야 통과**로 인정. C4(00-04): 5개 전부, C5(05-09): 5개 전부. |

---

## 6. CPP Module 통과 판단 규칙

CPP Module 묶음(14열: 00-04, 18열: 05-09)의 셀 상태 결정 로직:

| 조건 | 셀 상태 |
| :--- | :--- |
| 해당 그룹의 **모든 모듈 통과** | `cell--pass` (녹색) |
| 하나라도 **진행 중** (나머지 통과 여부 무관) | `cell--progress` (청색) |
| **일부만 통과**, 진행 중인 것 없음 | `cell--partial` (주황 — 일부 완료 표시) |
| **전부 미시작** | `cell--empty` (회색) |

> [!NOTE]
> `choice-sub` 구조로 각 모듈의 개별 상태를 툴팁에서 확인 가능하도록 합니다.
