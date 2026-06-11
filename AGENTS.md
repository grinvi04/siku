# AGENTS.md — 프로젝트 작업 규약 (AI 도구 공통)

> 이 파일은 모든 AI 코딩 도구의 단일 규약 출처다.
> Claude Code는 CLAUDE.md의 `@AGENTS.md` import로 이 파일을 읽는다.

## 프로젝트 개요

소규모 모임(저녁모임·자전거·여행) 특화 PWA — 모임 기록, 사진 공유, 경비 정산.

- 스택: Vite + React + TypeScript + Tailwind v4 + TanStack Query + React Router
- 백엔드: Supabase (Postgres + Auth + Storage + RLS), 서버 코드 없음
- 배포: Vercel 정적 배포 + Edge Function 1개(`api/og.ts`, 초대 링크 OG)
- 추후 Capacitor 네이티브 전환 전제 — 구조 원칙은 아래 참조

## 코드 구조 원칙 (Capacitor 전환 대비)

- `src/core/` — 순수 TS만. 브라우저/플랫폼 API import 금지 (정산·클러스터링 로직)
- `src/services/` — 플랫폼 API는 인터페이스(`interfaces.ts`) 뒤로, `web/` 구현체 + 팩토리
- `src/data/` — Supabase 접근은 이 층에만. UI 컴포넌트에서 supabase-js 직접 호출 금지
- `src/features/` — 도메인별 화면·훅

## 브랜치 정책

- `main` 직접 커밋 금지 (`.githooks/pre-commit`으로 차단)
- 작업 브랜치: `feature/*`, `fix/*` → PR → merge

## 품질 게이트

- 커밋 전: lint + test 통과 필수
- `src/core/` 변경은 단위 테스트 동반 필수

## 빌드·테스트 명령

- 품질 검증: `npm run lint`
- 테스트: `npm test` (vitest)
- 빌드: `npm run build`
- 개발 서버: `npm run dev`

## 도메인 규칙 (정산)

- 정산은 이벤트별 독립. 금액은 KRW 정수(원). 음수 지출 = 환불·환급
- 항목별 분할: share_amount 명시분 제외 후 균등, 나머지는 user_id 정렬순 +1원 (결정적)
- 이체 금액 표시·생성은 100원 단위 반올림, 차액은 채권자 흡수 (내부 계산은 1원 단위)
- 정산 확정(closed) 시 지출 잠금. 재확정 시 confirmed 송금은 선지급으로 차감
- 결제자가 참여자가 아닐 수 있음. 참여자 0명·0원 지출 금지

## 코딩 컨벤션

- 가정하지 말 것 — 불확실하면 묻는다
- 문제를 풀 수 있는 최소한의 코드 — 요청하지 않은 기능·추상화 금지
- 외과적 수정 — 꼭 필요한 것만 건드린다
- 기존 코드 스타일에 맞춘다

## 금지 사항 (모든 도구 공통)

- `.env`·시크릿을 코드/로그/외부로 노출 금지
- `git reset --hard`, 핵심 디렉토리 `rm -rf` — 사용자가 직접 실행
- 글로벌 패키지 설치 금지 (`npm install -g` 등) — 로컬 설치(`--save-dev`·`npx`) 사용
- Supabase 운영 프로젝트 직접 조작 금지 — 스키마 변경은 `supabase/migrations/`로만
