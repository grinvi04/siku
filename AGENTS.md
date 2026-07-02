# AGENTS.md — 프로젝트 작업 규약 (AI 도구 공통)

> 이 파일은 모든 AI 코딩 도구의 단일 규약 출처다.
> Claude Code는 CLAUDE.md의 `@AGENTS.md` import로 이 파일을 읽는다.

## 프로젝트 개요

소규모 모임(저녁모임·자전거·여행) 특화 PWA — 모임 기록, 사진 공유, 경비 정산.

- 스택: Vite + React + TypeScript + Tailwind v4 + TanStack Query + React Router
- 백엔드: Supabase (Postgres + Auth + Storage + RLS) + Edge Functions 2개
  (`supabase/functions/nearby-places` 장소 후보, `supabase/functions/parse-receipt` 영수증 OCR)
- 배포: Vercel 정적 배포 (초대 링크 OG용 `api/og.ts`는 계획 단계 — 미구현)
- **PWA 단독 운영** — 네이티브(Capacitor) 전환 계획 없음 (2026-06-13 확정). 기능 제안은 웹 역량(Web Share, 웹 푸시 등) 기준

## 코드 구조 원칙 (관심사 분리)

- `src/core/` — 순수 TS만. 브라우저/플랫폼 API import 금지 (정산·클러스터링 로직 — 테스트 용이성)
- `src/services/` — 플랫폼 API는 인터페이스(`interfaces.ts`) 뒤로, `web/` 구현체 + 팩토리
- `src/data/` — Supabase 접근은 이 층에만. UI 컴포넌트에서 supabase-js 직접 호출 금지
- `src/features/` — 도메인별 화면·훅

## 브랜치 정책 (git flow — harness 표준)

- `main`, `develop` 직접 커밋 금지 (`.githooks/pre-commit`으로 차단)
- 기능 개발·수정: `develop → feature/* | fix/* → PR → develop`
- 운영 핫픽스: `main → hotfix/* → PR → main (tag) + develop back-merge`
- 릴리즈: `develop → release/vX.X.X → PR → main (tag) + develop back-merge`

## 품질 게이트

- 커밋 전: lint + test 통과 필수
- `src/core/` 변경은 단위 테스트 동반 필수

## 빌드·테스트 명령

- 품질 검증: `npm run lint`
- 테스트: `npm test` (vitest 단위) / `npm run test:e2e` (Playwright — dev 서버 자동 기동)
- 빌드: `npm run build`
- 개발 서버: `npm run dev`

## 도메인 규칙 (정산)

- 정산은 이벤트별 독립. 금액은 KRW 정수(원). 음수 지출 = 환불·환급
- 항목별 분할: share_amount 명시분 제외 후 균등, 나머지는 user_id 정렬순 +1원 (결정적)
- 이체 금액 표시·생성은 100원 단위 반올림, 차액은 채권자 흡수 (내부 계산은 1원 단위)
- 정산 확정(closed) 시 지출 잠금. 재확정 시 confirmed 송금은 선지급으로 차감
- 결제자가 참여자가 아닐 수 있음. 참여자 0명·0원 지출 금지

## 코딩 컨벤션

- import는 `@/` 별칭(=src) 사용 — 상대경로는 같은 폴더 sibling(`./x`)만 허용
- 하위 화면 이탈은 `BackLink`(명시적 부모 경로, push)로 — `navigate(-1)` 금지
  (deep link·로그인 `?next=` 진입 시 인앱 히스토리가 없어 깨짐). 저장 성공 후 자동 이동만 `replace`
- 컴포넌트: 파일당 1개(전용 보조 컴포넌트는 같은 파일 하단 허용), PascalCase 파일명·named export,
  props는 TS 타입 필수(네이티브 속성은 `ButtonHTMLAttributes` 등 확장), 목록 key에 배열 인덱스 금지
- 파생 가능한 값은 effect로 동기화하지 말고 렌더 중 계산 (React 공식 'You Might Not Need an Effect')
- 공용 라벨·상수는 data/ 레이어에서 export — 화면마다 중복 정의 금지
- 가정하지 말 것 — 불확실하면 묻는다
- 문제를 풀 수 있는 최소한의 코드 — 요청하지 않은 기능·추상화 금지
- 외과적 수정 — 꼭 필요한 것만 건드린다
- 기존 코드 스타일에 맞춘다

## 금지 사항 (모든 도구 공통)

- `.env`·시크릿을 코드/로그/외부로 노출 금지
- `git reset --hard`, 핵심 디렉토리 `rm -rf` — 사용자가 직접 실행
- 글로벌 패키지 설치 금지 (`npm install -g` 등) — 로컬 설치(`--save-dev`·`npx`) 사용
- Supabase 운영 프로젝트 직접 조작 금지 — 스키마 변경은 `supabase/migrations/`로만

## 문서 관리

> **이 repo의 프로젝트 상태는 repo/GitHub에 둔다.** 플랜·스펙은 `docs/specs/`, 백로그·할 일은 GitHub Issues + Milestone(`/milestone`), 작업로그는 git 히스토리 + CHANGELOG/릴리즈노트, 설계 결정·도메인 지식은 `docs/decisions.md`에 기록한다. **도구 로컬 AI 메모리(예: `~/.claude` 메모리)에 프로젝트 상태·백로그·작업로그·결정·도메인 지식을 두지 않는다**(다른 PC·세션·사람이 못 보고 유실). 로컬 메모리는 팀 공유 불필요한 *개인 작업습관*에만 최소로. (정본: `ai-collaboration.md`)

## 배포·헬스체크

- 운영: `https://siku-app.vercel.app` (Vercel 정적 — 백엔드 없음)
- 헬스: `curl -sf -o /dev/null -w "%{http_code}" https://siku-app.vercel.app` (200)
- 배포 신선도(team-harness `operations.md` §6): `vercel ls siku` 로 최신 프로덕션 배포 READY·시각이 릴리즈와 일치하는지 확인 (liveness ≠ freshness — 200만으론 구버전 못 거름).
