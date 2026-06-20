# settle-share 스펙

## 1. 목표 & Why
확정된 정산 결과(누가 누구에게 얼마)를 읽기 좋은 텍스트로 묶어 공유·복사한다 — 멤버들이 앱을 열지 않아도 모임 채팅(카톡 등)에서 누가 얼마를 보낼지 한눈에 보게 하기 위함.
**성공 기준(측정 가능): 확정 정산 화면에서 버튼 1번으로 전체 이체 내역이 텍스트로 공유(또는 클립보드 복사)된다.**

## 2. Scope
- **In:** 확정 정산 이체 목록을 텍스트로 포맷 → Web Share API(`navigator.share`) 공유, 미지원·실패 시 클립보드 복사 폴백. `SettleTab` 확정 영역에 공유 버튼 1개.
- **Out (Non-goals):** 미확정(preview) 정산 공유, 받는 사람 계좌번호 포함, 송금 완료/대기 상태 표기, 이미지/카드형 공유, 카카오 SDK 연동, 공유 링크(웹페이지) 생성, 이체 상태 변경.

## 3. 기능 요구사항 + 수용기준 (= 테스트 계약)
- **AC-1 (정상·core 포맷):** WHEN 확정 정산의 이체 목록(보내는사람·받는사람·금액)이 주어지면, the system SHALL `"<보내는사람> → <받는사람> <금액>"` 줄을 `formatKrw`(100원 단위) 표기로 묶고 모임명·총 송금건수를 포함한 텍스트를 반환한다.
- **AC-2 (경계·이체 0건):** WHILE 확정 정산의 이체가 0건이면, the system SHALL "보낼 송금이 없어요" 류의 텍스트를 반환한다(빈 목록에서 크래시 없음).
- **AC-3 (정상·공유):** WHEN 사용자가 공유 버튼을 누르면, the system SHALL `navigator.share`로 텍스트 공유 시트를 띄운다.
- **AC-4 (예외·폴백):** IF `navigator.share`가 없거나 공유가 취소/실패하면 THEN the system SHALL 클립보드에 텍스트를 복사하고 "복사했어요" 토스트를 띄운다(에러로 깨지지 않음).
- **AC-5 (경계·노출 조건):** WHILE 확정 정산이 없으면(`closed=null`), the system SHALL 공유 버튼을 노출하지 않는다.

## 4. 제약 / 비기능
- `core/` 포맷 함수는 순수 TS(브라우저 API import 금지) — vitest 단위테스트 필수(AGENTS.md).
- 금액 표기는 기존 `formatKrw` 재사용(100원 단위 도메인 규칙).
- 계좌번호는 텍스트에 포함하지 않는다(결정) — 기존 개별 계좌 복사 기능 유지.

## 5. 경계 / Do-Not
- ✅ 해도 됨: `core/settlement`에 순수 포맷 함수 추가, `SettleTab`에 버튼·핸들러 추가, `lib/format`·`nameOf` 재사용.
- ⚠️ 먼저 물어봐: 범위 확장(공유 링크·이미지·SDK 등) — 이번 범위 밖.
- 🚫 절대 금지: `navigator.*` 등 플랫폼 API를 `core/`에 import · 컴포넌트에서 Supabase 직접 호출 · 외부 SDK(카카오 등) 추가.

## 6. 결정 (Open Questions 해소 완료)
- 공유 대상 = **확정 정산만**(preview 제외).
- 텍스트 = **이름·금액만**(계좌번호 제외 — 민감정보).
- 송금 상태 = **표기 안 함**(보내는사람 → 받는사람 · 금액만).

---

## 7. 기술 접근 (HOW)
- **`src/core/settlement/shareText.ts`** (순수): `formatSettlementText({ groupName, lines })` — 이름이 이미 resolved된 이체 줄(`{ from, to, amount }`) 배열 + 모임명 → 텍스트 문자열. 브라우저 API 없음(의존성 규칙: 도메인 로직이 IO/플랫폼에 의존 안 함). `index.ts`에서 export.
- **`src/features/expenses/SettleTab.tsx`**: `nameOf` + `formatKrw`로 줄 생성 → `formatSettlementText` 호출 → `navigator.share`, 실패 시 `navigator.clipboard.writeText` + toast (기존 `copyAccount` 패턴 재사용). 버튼은 `closed`가 있을 때만 렌더.
- **테스트 전략**: AC-1·AC-2 → core 단위(vitest). AC-3·AC-4·AC-5 → 컴포넌트 동작 테스트(@testing-library, `navigator.share`/`clipboard` mock).

## 8. 태스크 (test-first 순서)
| # | 태스크 | AC 참조 | 대상 파일 | 검증(exit 0) | 의존 | [P] |
|---|---|---|---|---|---|---|
| 1 | core 공유텍스트 포맷 함수 + 단위테스트 | AC-1, AC-2 | `core/settlement/shareText.ts`(+test), `index.ts` | `npm test` | — | |
| 2 | SettleTab 공유 버튼 + Web Share + 클립보드 폴백 | AC-3, AC-4, AC-5 | `features/expenses/SettleTab.tsx` | `npm test` · `npm run build` | #1 | |

- **롤백 설계**: #1(core, 의존 없음)은 토대 — 틀리면 #2가 깨지므로 **fix-forward**. #2(UI, 리프)는 의존받는 게 없어 `git revert`로 **단독 롤백 가능**.
