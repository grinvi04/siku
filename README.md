# 식구 (SIKU)

소규모 모임(저녁모임·자전거·여행)의 **기록 · 사진 · 경비 정산**을 위한 모바일 PWA.

- 다녀온 곳: 사진의 EXIF(위치·시각)로 방문 장소를 자동 재구성
- 사진: 모임별 갤러리, 촬영 시각·위치 기준 자동 분류
- 정산: 항목별 참여자 선택 → 똑같이 나누거나 사람마다 금액 따로 지정 → 최소 이체 횟수 계산 → 계좌번호 복사로 송금 (플랫폼 비종속)

스택: Vite + React + TS + Tailwind v4 + TanStack Query / Supabase / Vercel.
규약은 [AGENTS.md](AGENTS.md), 디자인은 [DESIGN.md](DESIGN.md), DB는 `supabase/migrations/` 참조.

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
