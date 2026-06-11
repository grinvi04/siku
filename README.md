# 모임 (moim)

소규모 모임(저녁모임·자전거·여행)의 **기록 · 사진 · 경비 정산**을 위한 모바일 PWA.

- 다녀온 곳: 사진의 EXIF(위치·시각)로 방문 장소를 자동 재구성
- 사진: 모임별 갤러리, 촬영 시각·위치 기준 자동 분류
- 정산: 항목별 참여자 선택 → 최소 이체 횟수 계산 → 계좌번호 복사로 송금 (플랫폼 비종속)

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
2. SQL Editor에서 `supabase/migrations/` 파일을 번호 순서대로 실행
   (또는 `npx supabase db push` — supabase CLI 링크 후)

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
