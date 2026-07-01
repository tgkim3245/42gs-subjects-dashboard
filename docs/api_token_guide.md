# 42 API 연동 가이드 (토큰 발급 및 설정)

이 문서는 42-subject-dashboard 익스텐션에서 42 API를 호출하기 위한 권한(Token)을 얻고 설정하는 과정을 안내합니다.
이 익스텐션은 외부 서버를 거치지 않고 브라우저에서 직접 API를 호출하므로, 사용자 본인의 API Token이 필요합니다.

---

## 1단계: Intra에서 애플리케이션 생성

1. **[New Application 페이지(https://profile.intra.42.fr/oauth/applications/new)](https://profile.intra.42.fr/oauth/applications/new)** 로 이동합니다.
2. 아래 내용을 참고하여 폼을 작성하고 `Submit`을 누릅니다.
   - **Name**: `42 Subject Dashboard Extension` (또는 본인이 알아보기 쉬운 이름)
   - **Redirect URI(s)**: `https://github.com/tgkim3245/42gs-subjects-dashboard` (실제 리다이렉트는 발생하지 않으므로 임의의 유효한 URL 입력)
   - **Scopes**: `public` (기본값 유지)
   - **Public**: `체크 해제` (나만 사용할 용도)

## 2단계: API Credentials (자격 증명) 확인

앱 생성이 완료되면 다음 두 가지 정보가 나타납니다.
* **UID (Client ID)**
* **SECRET (Client Secret)**

> ⚠️ **보안 주의:** `SECRET`은 절대로 외부에 공개하거나 소스코드(Github 등)에 올리면 안 됩니다.

## 3단계: 익스텐션에 인증 정보 등록

42 API 정책상 일반 유저는 직접 토큰을 발급하는 버튼(Personal Access Token 탭)이 제공되지 않습니다. 대신, **2단계에서 발급받은 UID와 SECRET을 익스텐션에 입력하면 익스텐션이 자동으로 토큰을 발급**받아 통신합니다.

1. 대시보드 화면 우측 상단의 톱니바퀴(⚙️) **설정 버튼**을 클릭합니다.
2. 설정 패널에 있는 **API UID**와 **API SECRET** 입력 칸에 위에서 발급받은 두 값을 각각 붙여넣습니다.
3. `저장 및 토큰 발급` 버튼을 누릅니다.
4. 익스텐션이 42 서버와 통신하여 자동으로 Access Token을 발급받아 내부에 안전하게 저장하며, 이제 대시보드가 정상 동작합니다.

> 💡 **참고 (내부 동작 원리):** 
> 익스텐션은 입력하신 UID와 SECRET을 이용해 42 서버의 `/oauth/token` (Client Credentials Flow)으로 요청을 보내고 2시간짜리 토큰을 받아옵니다. 토큰이 만료되면 저장된 UID/SECRET으로 알아서 재발급을 수행합니다.
