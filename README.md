# 식구 (SIKU)

[![CI](https://github.com/grinvi04/siku/actions/workflows/ci-gate.yml/badge.svg)](https://github.com/grinvi04/siku/actions/workflows/ci-gate.yml)
![PWA](https://img.shields.io/badge/PWA-Vite·React·Supabase-2A5BD7)
![license](https://img.shields.io/badge/license-All%20Rights%20Reserved-lightgrey)

소규모 모임(저녁모임·자전거·여행)의 **기록 · 사진 · 경비 정산**을 위한 모바일 PWA.

- 다녀온 곳: 사진의 EXIF(위치·시각)로 방문 장소를 자동 재구성
- 사진: 모임별 갤러리, 촬영 시각·위치 기준 자동 분류
- 정산: 항목별 참여자 선택 → 균등 분할 또는 개인별 금액 지정 → 최소 이체 횟수 계산 → 계좌번호 복사로 송금 (플랫폼 비종속)

스택: Vite + React + TS + Tailwind v4 + TanStack Query / Supabase / Vercel.
규약은 [AGENTS.md](AGENTS.md), 디자인은 [DESIGN.md](DESIGN.md), DB는 `supabase/migrations/` 참조.

## 스크린샷

<!-- 로그인 후 화면 캡처를 docs/screenshots/ 에 추가한 뒤 아래 주석을 해제하세요
| 홈 | 정산 | 사진 |
|----|------|------|
| ![홈](docs/screenshots/home.png) | ![정산](docs/screenshots/settle.png) | ![사진](docs/screenshots/photos.png) |
-->

_준비 중 — 인증 후 화면이라 캡처를 `docs/screenshots/`에 추가 예정._

## 개발

```bash
npm install
cp .env.example .env   # Supabase 값 입력 (아래 셋업 참조)
npm run dev
```

- 테스트: `npm test` / 린트: `npm run lint` / 빌드: `npm run build`
- main 직접 커밋 금지: `git config core.hooksPath .githooks` (클론 후 1회)

## Supabase 셋업 (1회)

1. [supabase.com](https://supabase.com)에서 프로젝트 생성 → Settings → API의 URL과 anon key를 `.env`에
2. `npx supabase db push`로 `supabase/migrations/`를 적용 (supabase CLI를 프로젝트에 링크 후)
   — 권장. SQL Editor에서 파일을 번호 순서대로 직접 실행해도 된다(CLI 미사용 시)

## 로그인 셋업 (이메일 매직링크, 1회)

비밀번호 없이 메일로 받은 1회용 링크(만료 있음)로 로그인한다. 외부 콘솔 의존 없음.

1. Supabase → Authentication → Providers → **Email** 활성화 확인 (기본 활성),
   "Confirm email" 설정은 매직링크 흐름 그대로 사용
2. Authentication → URL Configuration:
   - Site URL: 배포 도메인 (로컬 개발 시 `http://localhost:5173`)
   - Redirect URLs에 `http://localhost:5173/auth/callback`과 `https://<배포도메인>/auth/callback` 추가
3. (운영 시 권장) Supabase 기본 메일 발송은 시간당 횟수 제한이 있으므로
   Authentication → SMTP Settings에 자체 SMTP(예: Resend 무료 티어) 연결

> 소셜 로그인(카카오 등)은 필요해지면 Supabase Provider 추가로 확장 — 현 코드는 auth 레이어만 바꾸면 됨.

## 영수증 OCR 셋업 (Google Vision 무료 티어, 1회)

지출 추가 화면의 "영수증 찍어서 자동 입력"이 사용하는 기능. 월 1,000장까지 무료.
GCP 키는 Edge Function 시크릿에만 저장되고 클라이언트에 노출되지 않는다.

1. [console.cloud.google.com](https://console.cloud.google.com) → 프로젝트 생성 (결제수단 등록 필요 — 무료 한도 내에서는 과금 없음)
2. API 및 서비스 → 라이브러리 → **Cloud Vision API** 활성화
3. API 및 서비스 → 사용자 인증 정보 → **API 키** 생성 → 키 제한에서 "Cloud Vision API"만 허용
4. Supabase CLI 로그인 후 시크릿 등록 + 함수 배포:

```bash
npx supabase login                       # 브라우저 인증 (1회)
npx supabase link --project-ref qbqxhlqjrfdbzlewsdym
npx supabase secrets set GOOGLE_VISION_API_KEY=<발급한 키>
npx supabase functions deploy parse-receipt
```

배포 전까지는 버튼을 눌러도 "영수증을 읽지 못했어요"가 떠서 수동 입력으로 동작한다.

## 라이선스

투명성·도구(브랜치 보호 등) 목적으로 공개돼 있을 뿐, 코드 재사용 라이선스는 부여하지 않는다 (All Rights Reserved). [LICENSE](LICENSE) 참조.
