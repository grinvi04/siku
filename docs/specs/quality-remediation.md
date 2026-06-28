# 품질 리메디에이션 로드맵 — siku

> 자매 프로젝트 **erp** 감사에서 드러난 결함 클래스를 siku에 동일 기준으로 점검한 결과를 정리하고,
> 남은 경미 항목과 미측정 항목의 처리 방침을 기록한다. 표준 출처: team-harness `docs/`.

## §0 Context

- **계기**: 자매 ERP(erp)를 실 스택으로 감사하던 중 결함 다수 발견 → team-harness 표준화. siku도
  같은 클래스(테넌트/사용자 격리 누락·마이그레이션 드리프트·입력검증 부재·시크릿 노출)일 가능성이 있어
  **읽기 전용 감사**를 수행했다.
- **감사 결과 (실측)**:
  - **HIGH/MEDIUM 결함 0건.**
  - **RLS 전 테이블 커버** — `profiles·groups·group_members·events·event_participants·visits·photos·
    expenses·expense_participants·settlements·settlement_transfers·ocr_usage` + `storage.objects(photos)`
    까지 RLS 활성. `settlements·settlement_transfers·ocr_usage`는 의도된 **default-deny**(직접 정책 없음,
    `SECURITY DEFINER` RPC / service_role로만 변경). 멤버십 헬퍼(`is_group_member`/`event_group`)는
    `SECURITY DEFINER + set search_path=public`로 자기참조 재귀를 차단 — 올바른 패턴.
  - **마이그레이션 forward-only** — `0001`~`0016` 순차. 적용분 수정 없이 후속 마이그레이션으로 정책을
    교정(`0012`→`0013`, `0015`→`0016`). `0016` 주석에 "0015는 v0.2.1로 릴리즈 — 수정 금지" 명시.
  - **실 e2e 테스트 양호** — `tests/e2e`(smoke/flows/settle)가 service_role로 실제 사용자·세션을 만들어
    실 흐름을 검증(mock-only 아님). 단위 테스트 6종(정산 split/balance/simplify·영수증 파싱·클러스터링 등).
  - **시크릿** — `.env` 미추적(`.gitignore`), service_role 키는 Vite `VITE_` 접두사 규칙상 클라이언트
    번들에 유입 불가하며 `dist` 실측에서도 부재 확인(번들엔 공개키 `sb_publishable_…`만).
  - **`verify_jwt = true`** 가 두 Edge Function에 명시적으로 고정 — `parse-receipt`의 서명 미검증 JWT
    디코딩이 이 신뢰경계 위에 안전하게 의존(`supabase/config.toml` 주석이 정확히 인지).
- **성공 기준**: (a) 아래 LOW 1건을 실수정하거나 "설계상 수용"으로 명시 결정, (b) INFO 항목을 문서화하여
  의식적 수용으로 전환, (c) 미측정 항목(원격 DB 드리프트)을 배포 환경에서 1회 확인.

> 결론적으로 siku는 erp-클래스 결함이 **거의 재현되지 않은** 잘 통제된 코드베이스다. 본 문서는 대규모
> 리메디에이션이 아니라 **경미 항목 정리 + 미측정 항목 확인**을 목적으로 한다.

## §1 결함 인벤토리 (LOW / INFO만)

| 심각도 | 클래스 | 위치 | 결함 | 근거 | team-harness 표준 |
|---|---|---|---|---|---|
| LOW | 데이터 무결성 | `supabase/migrations/0014_storage_delete_group.sql:6` vs `0002_rls.sql:101` | storage 파일 삭제는 **그룹 멤버 전체** 허용인데 `photos` 행 삭제는 **업로더만** 허용 → 멤버가 타인 사진 파일만 지우면 `photos` 행이 남아 **깨진 참조(orphan row)** 가능 | 두 정책의 권한 주체 불일치(파일=멤버, 행=업로더). `0014` 주석은 반대 방향(고아 파일)만 언급 | db-standards.md (참조 무결성) |
| INFO | 식별자/PII 노출 | `supabase/migrations/0002_rls.sql:40-47` | `profiles_select`가 **동일 그룹 멤버에게 타인 계좌번호·은행·예금주 전체 노출** | 정산 송금 UX상 의도된 설계(필드 단위 제한 없음). 비결제자에게도 전원 노출 | auth-standards.md (데이터 스코프) |
| INFO | 입력검증(서버) | `supabase/migrations/0003_rpc.sql` `close_settlement` | 이체 금액 **정합성(지출 균형과 일치)은 서버 미검증** — 클라이언트(`core/settlement`, 단위 테스트됨)가 계산해 전달, 서버는 멤버십·양수·당사자만 검증 | 함수 주석에 의도 명시. 같은 그룹 내 신뢰 범위 가정 | api-standards.md (서버측 검증) |
| INFO | 시크릿 동거 | `.env`(gitignore됨) / `tests/e2e/helpers/admin.ts:20` | `SUPABASE_SERVICE_ROLE_KEY`가 클라이언트 `VITE_*` 키와 **같은 `.env`**에 존재 | Vite는 `VITE_` 접두사만 번들에 인라인 → **번들 미유입 실측 확인**. `.env`는 미추적 | operations.md (시크릿 관리) |
| 미측정 | 마이그레이션 운영안전 | (배포 환경) | 원격 DB ↔ 마이그레이션 **드리프트 미확인** — 감사 시 DB 접속 권한 없어 `supabase db diff` 미실행 | 코드상 드리프트 징후는 없으나 원격 상태는 미관측 | db-standards.md (forward-only·드리프트) |

## §2 Acceptance Criteria

- **AC-1 (LOW)**: storage 파일 삭제 권한과 `photos` 행 삭제 권한의 주체를 **일치**시키거나, 행·파일이
  **항상 함께 삭제**되도록 보장한다 → orphan row가 발생할 수 없음을 e2e 또는 수동 시나리오로 확인.
- **AC-2 (INFO 3건)**: 각 항목을 "설계상 수용" 또는 "문서화 후 수용"으로 **명시 결정**하고 본 문서에 근거를
  남긴다(실수정 없음). 신뢰모델·UX 요구가 결정의 근거.
- **AC-3 (미측정)**: 배포 환경에서 `supabase db diff`(또는 동등 절차)를 **1회 실행**해 드리프트 없음을
  확인하고 결과를 기록한다.

## §3 PR 분해

| PR | 범위 | 대상 | 비고 |
|---|---|---|---|
| PR-A | AC-1 실수정 | 새 마이그레이션(`0017_*`)로 storage delete 정책을 `photos` 행 삭제 권한(업로더)과 통일 — **기존 마이그레이션 수정 금지(forward-only)** | RLS·default-deny 패턴 유지 |
| (결정문서) | AC-2 | 본 문서 §4에 INFO 3건 수용 결정 기록 | 코드 변경 없음 |
| (운영 1회) | AC-3 | 배포 환경에서 `supabase db diff` 실행·기록 | PR 아님(운영 점검) |

> 이 로드맵 문서 자체는 머지하지 않는다(검토용). 실수정 PR-A는 별도 진행.

## §4 INFO 항목 수용 결정 (기록)

- **계좌 PII 동일그룹 노출**: 정산 송금이 앱의 핵심 가치이고, 송금하려면 같은 식구의 계좌가 필요 →
  **설계상 수용**. 더 좁히려면 정산 당사자 한정 뷰/RPC로 노출 범위를 축소하는 후속 과제로 둔다.
- **정산 금액 서버 미검증**: 소규모 신뢰 그룹("식구") 모델 + 클라이언트 계산이 단위 테스트로 보증됨 →
  **현 상태 수용**. 강화 시 서버에서 지출 기반 잔액을 재계산·대조.
- **service_role `.env` 동거**: 번들 미유입이 실측으로 확인됨 → **수용**. 분리를 원하면 `.env.test`로
  service_role을 격리하는 선택지 존재(선택).

## §5 Do-Not (잘 돼 있으니 깨지 말 것)

- **RLS를 끄거나 우회하지 말 것** — 전 테이블 RLS + storage 경로 정책이 격리의 핵심.
- **default-deny를 망가뜨리지 말 것** — `settlements·settlement_transfers·ocr_usage`는 직접 정책 없이
  RPC/service_role로만 변경되는 것이 의도다. 편의를 위해 직접 INSERT/UPDATE 정책을 추가하지 말 것.
- **`SECURITY DEFINER + set search_path=public` 패턴을 유지할 것** — 헬퍼·RPC의 재귀/권한상승 방어.
- **`verify_jwt = true` 고정을 풀지 말 것** — `parse-receipt`의 서명 미검증 디코딩이 이 전제 위에서만
  안전하다.
- **기존 마이그레이션을 수정하지 말 것** — forward-only. 정책 변경은 새 번호 마이그레이션으로.
- **`.codex/` 미접촉** — 본 감사·문서 작업 전 과정에서 읽기/수정 일절 없음.

---

erp-클래스 결함이 siku에서는 거의 재현되지 않았다 — 잘 통제된 코드베이스이며, 신규 부채는 harness-guard
v0.7.0 게이트가 차단한다.
