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

## 카카오 로그인 셋업 (1회)

> ⚠️ 비즈 앱 미전환 전제 — 이메일 동의항목을 사용하지 않는다.

1. [Kakao Developers](https://developers.kakao.com) → 애플리케이션 추가
2. 앱 설정 → 플랫폼 → Web에 도메인 등록 (로컬: `http://localhost:5173`, 배포: Vercel 도메인)
3. 제품 설정 → 카카오 로그인 활성화, Redirect URI에
   `https://<프로젝트ref>.supabase.co/auth/v1/callback` 등록
4. 동의항목: **닉네임, 프로필 사진만** 설정 (이메일 사용 안 함)
5. Supabase 대시보드 → Authentication → Providers → Kakao 활성화,
   카카오 REST API 키 + Client Secret 입력
6. Supabase → Authentication → URL Configuration → Redirect URLs에
   `http://localhost:5173/auth/callback`과 배포 도메인 추가

**M1 검증 항목**: 이메일 없는 카카오 계정으로 가입이 되는지 첫 로그인에서 확인.
막히면 폴백: ① 카카오 OIDC + `signInWithIdToken` ② 이메일 매직링크.
