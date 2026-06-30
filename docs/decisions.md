# siku 설계 결정 기록 (Decision Log)

확정된 제품·아키텍처 결정의 단일 출처. AI 작업 노트(로컬 메모리)에 흩어져 있던 것을 repo로 이전(가시·공유·git).

---

## 플랫폼 — PWA 단독 (Capacitor 네이티브 안 함)

- **모바일 네이티브(Capacitor) 전환 안 함, PWA 단독 확정**(사용자, 2026-06-13: "굳이 네이티브로 할 이유 없음").
- AGENTS.md의 "추후 Capacitor 전환 전제" 문구는 제거. 단 그 전제가 만든 **구조 원칙(`src/core` 순수 TS, services 인터페이스 분리, data 레이어 단일 접근)은 관심사 분리로서 유지** — 근거만 PWA로 바꿈.
- 네이티브 전용 기능(푸시 등) 제안 금지. 웹/PWA 역량(웹 푸시·Share API 등) 우선.

## M2 기능 (출시 완료)

- **개인별 금액 커스터마이징** (v0.4.0): `ExpenseFormPage` "똑같이/개인별" 토글 + 참여자별 금액·미리보기. 데이터 모델 변경 없음(기존 `share_amount` UI 노출).
- **정산 결과 공유 settle-share** (v0.4.6, `/plan→/feature-add` 첫 실전): 확정 정산을 'A → B N원' 텍스트로 Web Share/클립보드 공유. 이름·금액만(계좌·상태 제외 — 사용자 결정). `core/settlement/shareText.ts`(순수) + `lib/share.ts`(주입형 헬퍼: Web Share 미지원·취소·실패 시 클립보드 폴백) + SettleTab 버튼(이체>0). **DOM 테스트 셋업 없어 공유 로직을 주입형 순수 헬퍼로 빼 vitest 검증.**

## 보안·무결성 결정

- **`share_amount` 서버측 무결성 부재 — 현 상태 수용(2026-06-14).** RLS는 그룹 멤버 여부만 검사 → 악의 멤버가 supabase-js 직접 호출로 음수/총액초과 삽입 가능. 그러나:
  - `CHECK (share_amount >= 0)`은 **부적합**: 환불 지출은 음수 저장(UI `refund ? -v : v`)이라 정상 데이터를 깸. 단일 컬럼 CHECK는 부모 `expenses.amount` 참조 불가 → "부호 일치 + |명시합계| ≤ |amount|" 불변식 표현 불가.
  - 제대로 막으려면 `expense_participants` BEFORE INSERT/UPDATE 트리거(split.ts 전제 복제) 필요 — 코어/DB 중복 drift 부채. 신뢰기반 소그룹 + split.ts가 불일치를 throw로 시끄럽게 실패(조용한 부패 아님)하므로 미적용. **편집 권한을 덜 신뢰되는 맥락으로 넓힐 때 재검토.**
- **CSP enforce** (v0.4.3, 프로덕션 라이브): report-only→enforce. localStorage 세션 토큰 XSS 방어. `vercel.json` `Content-Security-Policy`(script-src 'self', connect/img는 *.supabase.co). 검증: 정적분석 + Playwright 운영 부팅 실측 + 사용자 인증클릭 전부 클린. 롤백 = 헤더 키 `-Report-Only`.
  - **style 'unsafe-inline' 제거 — 권장 안 함(2026-06-17).** Avatar(사용자별 색)·SettleTab(진행바 %)·HomePage(그룹별 color-mix) 3곳이 본질적 동적 인라인 스타일. CSP nonce/hash는 동적 `style=` 속성에 적용 불가 → 완전 제거 불가. 진짜 위협(스크립트 주입)은 script-src 'self'로 차단돼 style-inline 보안이득 미미 → 현 정책 유지.
  - ⚠️ 검증 공백: CI e2e는 dev라 vercel.json 헤더 미적용 → CSP 깨짐을 CI가 못 잡음. CSP 변경 시 Playwright로 운영/프리뷰 직접 관측.
- **보안 헤더**(v0.4.1): X-Frame-Options DENY·nosniff·Referrer-Policy·HSTS·COOP. PWA/a11y/SEO 보강(Lighthouse Perf93·A11y97·SEO91), `mobile-web-app-capable`, `main` landmark, `robots.txt`.

## 품질 결정

- **flaky e2e "기록 삭제" — retries로 흡수**(PR #26): 원인은 버튼이 `isCreator`(session 의존) 게이트라 session 레이스 시 드물게 타임아웃. `playwright.config.ts` `retries: CI ? 2 : 0`(로컬 0 유지). 근본 레이스 제거는 미수행 — 재발 잦으면 결정적 session-wait로 재검토.

## 브랜드

- **밥그릇 마크로 통일**(v0.4.4→고도화 v0.4.5): 라인형 밥그릇+김, 세로 그라데이션 #3360D9→#1E46AC. favicon·192·512·maskable·apple-touch 통일. `RiceBowl.tsx`도 동일 실루엣 정합(웜 팔레트 유지 — 파랑 브랜드↔웜 감성, 색 역할 분리). DESIGN.md에 '브랜드 마크' 섹션.

## 인프라/하네스

- **하네스 = team-harness `harness-guard` 플러그인**(PR #6 전환). siku 고유분만 잔존(validate-edit.sh 품질 루프, supabase/migrations 삭제 가드). `settings.json` extraKnownMarketplaces(grinvi04/team-harness) + enabledPlugins.
- develop 브랜치 도입(main과 동일 커밋 분기), pre-commit이 main+develop 직접 커밋 차단.
- **CI e2e = CI 내 로컬 Supabase 스택**(supabase start + status -o env로 .env) — 운영 키를 public repo Actions에 넣지 않음. CLI 핀 `2.107.0`(version:latest 504 회피). 마이그레이션 0015·0016이 Data API 역할 권한 최소화(스키마 자체 완결).
- gh 토큰 = fine-grained PAT, **checks read 권한 없음** → `gh pr checks` 403, commit status·actions/runs로 우회.
- 미적용(사용자 결정 대기): ai-review.yml(ANTHROPIC_API_KEY secret), `supabase db push`(0015·0016 운영 반영).

> branch protection·Gemini 봇 등 인프라 상태는 GitHub repo 현재 설정이 정본 — 이 문서는 결정 근거.
