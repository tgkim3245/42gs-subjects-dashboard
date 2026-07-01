# OAuth2 인증 및 보안 흐름 설계서

> **문서 버전:** v0.2 (결정 사항 반영)
> **최종 수정일:** 2026-07-01 (v0.2: 인증 방식 Personal Token으로 확정)
> **작성자:** -

---

## 1. 개요

이 문서는 외부 백엔드 서버 없이 크롬 익스텐션에서 안전하게 42 API OAuth 2.0 인증을 수행하는 흐름을 정의합니다.

> [!CAUTION]
> 클라이언트 사이드 익스텐션에서 `client_secret`을 소스 코드에 하드코딩하면, 코드를 열면 누구든 읽을 수 있습니다.
> **Client Secret은 반드시 사용자가 직접 입력하거나, PKCE 방식을 사용하여 Secret 없이 인증하는 것을 권장합니다.**

---

## 2. 인증 방식 비교 및 선택

| 방식 | 설명 | 보안 수준 | 선택 여부 |
| :--- | :--- | :--- | :--- |
| Authorization Code (기본) | client_secret 필요, 서버 필요 | ⚠️ Secret 노출 위험 | ❌ |
| Authorization Code + PKCE | Secret 없이 code_verifier/challenge 사용 | ✅ 권장 | ❌ **42 API 미지원** |
| Client Credentials (익스텐션 내장) | 사용자가 Intra에서 발급한 UID/SECRET을 익스텐션에 입력해 토큰 자동 발급 | ✅ 강력 (Storage 로컬 보관) | ✅ **채택 (확정)** |

> [!IMPORTANT]
> **[결정 완료]** 42 API 공식 문서 및 실사용 사례 조사 결과, 42 API는 PKCE(`code_challenge_method=S256`)를 **공식 지원하지 않습니다**.
> 과거와 달리 일반 유저의 Personal Access Token 직접 발급 탭도 막혀있으므로, **사용자가 자신의 API UID와 SECRET을 익스텐션 설정창에 입력하면 익스텐션이 직접 `POST /oauth/token` (Client Credentials)을 호출하여 토큰을 발급·갱신하는 방식**으로 최종 변경·확정합니다.

---

## 3. 채택 방식 A: Authorization Code + PKCE

### 3-1. 사전 준비

- **42 Intra → Settings → API → New Application** 에서 앱 등록.
- Redirect URI를 `https://<extension_id>.chromiumapp.org/` 로 설정.
  - 크롬 익스텐션 ID는 `chrome://extensions` 에서 확인 가능.
- `client_id` 만 manifest 또는 설정에 저장. **`client_secret` 는 저장하지 않음.**

### 3-2. PKCE 파라미터 생성

```
code_verifier  = 무작위 고엔트로피 문자열 (43~128자, Base64URL)
code_challenge = BASE64URL(SHA256(code_verifier))
```

크롬 익스텐션에서는 `crypto.subtle.digest` API로 브라우저 내에서 직접 생성 가능합니다.

---

### 3-3. 인증 흐름도

```
[사용자 → 익스텐션 팝업에서 "42 로그인" 버튼 클릭]
          │
          ▼
[Background Worker]
  code_verifier 생성 (crypto.getRandomValues)
  code_challenge = SHA256(code_verifier) → Base64URL
          │
          ▼
[chrome.identity.launchWebAuthFlow]
  URL: https://api.intra.42.fr/oauth/authorize
       ?client_id=<CLIENT_ID>
       &redirect_uri=https://<ext_id>.chromiumapp.org/
       &response_type=code
       &scope=public
       &code_challenge=<CHALLENGE>
       &code_challenge_method=S256
          │
  (브라우저가 42 Intra 로그인 페이지 열기)
  (사용자 로그인 및 권한 승인)
          │
          ▼
  Redirect URI로 authorization_code 반환
          │
          ▼
[Background Worker]
  POST https://api.intra.42.fr/oauth/token
  Body: {
    grant_type:    "authorization_code",
    client_id:     <CLIENT_ID>,
    code:          <AUTHORIZATION_CODE>,
    redirect_uri:  <REDIRECT_URI>,
    code_verifier: <CODE_VERIFIER>   ← Secret 대신 verifier 전송
  }
          │
          ▼
  응답: { access_token, expires_in, token_type }
          │
          ▼
[chrome.storage.local에 암호화 저장]
  { access_token, expires_at: Date.now() + expires_in * 1000 }
```

---

## 4. 채택 방식 B: 사용자 직접 Personal Token 입력 (Fallback)

42 API가 PKCE를 지원하지 않는 경우, 또는 개인 사용 목적의 간단한 구성을 원하는 경우에 사용합니다.

### 4-1. 흐름

```
[사용자 → 42 Intra → Settings → API → Personal Access Token 발급]
          │
          ▼
[익스텐션 팝업 → 설정 화면]
  입력창에 Personal Token 붙여넣기
          │
          ▼
[chrome.storage.local에 저장]
  { access_token: "<INPUT_TOKEN>", expires_at: null }
          │
          ▼
  이후 모든 API 호출 시 해당 토큰 사용
```

> [!NOTE]
> Personal Token은 만료 기간이 없거나 매우 길기 때문에 **TTL 체크가 불필요**하지만,
> 토큰이 탈취되면 취소할 방법이 제한적입니다. 사용자에게 이를 안내합니다.

---

## 5. Access Token 저장 및 갱신 관리

### 5-1. 스토리지 저장 구조

```json
{
  "auth": {
    "access_token": "xxxxxxxxx",
    "expires_at": 1751385600000,
    "token_type": "bearer"
  }
}
```

### 5-2. Token 유효성 체크 로직

```
API 호출 전
    │
    ▼
auth.expires_at 존재?
    │ NO (Personal Token) → 그대로 사용
    │ YES
    ▼
현재시간 < expires_at - 5분(버퍼)?
    │ YES → 그대로 사용
    │ NO  → Token 만료 처리
    ▼
PKCE 방식: launchWebAuthFlow 재실행 → 새 token 획득
Personal 방식: 팝업 알림 → 사용자에게 재입력 요청
```

> [!WARNING]
> `chrome.identity.launchWebAuthFlow`는 **Background Service Worker**에서 호출할 수 없습니다.
> Content Script 또는 Popup Script에서 호출해야 합니다.
> 이를 고려하여 인증 흐름은 **Popup → Background로 token 전달** 방식으로 설계합니다.

---

## 6. 보안 고려사항 체크리스트

| # | 항목 | 상태 |
| :--- | :--- | :--- |
| S1 | `client_secret` 을 소스코드 및 스토리지에 저장하지 않음 | ⬜ 구현 전 |
| S2 | `code_verifier`는 메모리에만 유지, 스토리지에 저장 안 함 | ⬜ 구현 전 |
| S3 | `access_token`은 `chrome.storage.local`에만 저장 (localStorage 금지) | ⬜ 구현 전 |
| S4 | 만료 5분 전 선제적 갱신으로 사용 중 토큰 만료 방지 | ⬜ 구현 전 |
| S5 | 모든 API 요청은 `Authorization: Bearer <token>` 헤더 사용 | ⬜ 구현 전 |

---

## 7. 열린 질문 (Open Questions)

| # | 질문 | 상태 |
| :--- | :--- | :--- |
| Q1 | 42 API가 PKCE(`code_challenge_method=S256`)를 공식 지원하는가? | ✅ **[결정]** 미지원 확인. PKCE 방식 폐기. Personal Token 방식 채택. |
| Q2 | 42 API Refresh Token을 발급해주는가? | ✅ **[결정]** Personal Token은 만료 없음. 해당 없음. |
| Q3 | 크롬 익스텐션 Redirect URI로 `chromiumapp.org` 형식 등록 가능한가? | ✅ **[결정]** Personal Token 방식 채택으로 Redirect URI 불필요. 해당 없음. |
