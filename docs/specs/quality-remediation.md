# 품질 리메디에이션 로드맵 — siku

> 자매 프로젝트 **erp** 감사에서 드러난 결함 클래스를 siku에 동일 기준으로 점검한 결과를 정리하고,
> 남은 경미 항목과 미측정 항목의 처리 방침을 기록한다. 표준 출처: team-harness `docs/`.
> §0~§5는 작성 당시의 감사·계획 기록이고 §6~§7은 로컬 QA와 첫 원격 게이트의 당시 기록이다. 현재 develop 인수 상태는 §8을 따른다.

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

| 심각도 | 클래스                | 위치                                                                        | 결함                                                                                                                                                                    | 근거                                                                                        | team-harness 표준                       |
| ------ | --------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------- |
| LOW    | 데이터 무결성         | `supabase/migrations/0014_storage_delete_group.sql:6` vs `0002_rls.sql:101` | storage 파일 삭제는 **그룹 멤버 전체** 허용인데 `photos` 행 삭제는 **업로더만** 허용 → 멤버가 타인 사진 파일만 지우면 `photos` 행이 남아 **깨진 참조(orphan row)** 가능 | 두 정책의 권한 주체 불일치(파일=멤버, 행=업로더). `0014` 주석은 반대 방향(고아 파일)만 언급 | db-standards.md (참조 무결성)           |
| INFO   | 식별자/PII 노출       | `supabase/migrations/0002_rls.sql:40-47`                                    | `profiles_select`가 **동일 그룹 멤버에게 타인 계좌번호·은행·예금주 전체 노출**                                                                                          | 정산 송금 UX상 의도된 설계(필드 단위 제한 없음). 비결제자에게도 전원 노출                   | auth-standards.md (데이터 스코프)       |
| INFO   | 입력검증(서버)        | `supabase/migrations/0003_rpc.sql` `close_settlement`                       | 이체 금액 **정합성(지출 균형과 일치)은 서버 미검증** — 클라이언트(`core/settlement`, 단위 테스트됨)가 계산해 전달, 서버는 멤버십·양수·당사자만 검증                     | 함수 주석에 의도 명시. 같은 그룹 내 신뢰 범위 가정                                          | api-standards.md (서버측 검증)          |
| INFO   | 시크릿 동거           | `.env`(gitignore됨) / `tests/e2e/helpers/admin.ts:20`                       | `SUPABASE_SERVICE_ROLE_KEY`가 클라이언트 `VITE_*` 키와 **같은 `.env`**에 존재                                                                                           | Vite는 `VITE_` 접두사만 번들에 인라인 → **번들 미유입 실측 확인**. `.env`는 미추적          | operations.md (시크릿 관리)             |
| 미측정 | 마이그레이션 운영안전 | (배포 환경)                                                                 | 원격 DB ↔ 마이그레이션 **드리프트 미확인** — 감사 시 DB 접속 권한 없어 `supabase db diff` 미실행                                                                        | 코드상 드리프트 징후는 없으나 원격 상태는 미관측                                            | db-standards.md (forward-only·드리프트) |

## §2 Acceptance Criteria

- **AC-1 (LOW)**: storage 파일 삭제 권한과 `photos` 행 삭제 권한의 주체를 **일치**시키거나, 행·파일이
  **항상 함께 삭제**되도록 보장한다 → orphan row가 발생할 수 없음을 e2e 또는 수동 시나리오로 확인.
- **AC-2 (INFO 3건)**: 각 항목을 "설계상 수용" 또는 "문서화 후 수용"으로 **명시 결정**하고 본 문서에 근거를
  남긴다(실수정 없음). 신뢰모델·UX 요구가 결정의 근거.
- **AC-3 (미측정)**: 배포 환경에서 `supabase db diff`(또는 동등 절차)를 **1회 실행**해 드리프트 없음을
  확인하고 결과를 기록한다.

## §3 PR 분해

| PR         | 범위        | 대상                                                                                                                                   | 비고                       |
| ---------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| PR-A       | AC-1 실수정 | 새 마이그레이션(`0017_*`)로 storage delete 정책을 `photos` 행 삭제 권한(업로더)과 통일 — **기존 마이그레이션 수정 금지(forward-only)** | RLS·default-deny 패턴 유지 |
| (결정문서) | AC-2        | 본 문서 §4에 INFO 3건 수용 결정 기록                                                                                                   | 코드 변경 없음             |
| (운영 1회) | AC-3        | 배포 환경에서 `supabase db diff` 실행·기록                                                                                             | PR 아님(운영 점검)         |

> 이 표는 당시 실행 계획이다. 실제 적용 여부는 §6과 Git 이력을 대조한다.

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

## §6 현행 상태와 로컬 QA 계약 (2026-10-07)

- `0017_storage_delete_no_orphan.sql`은 `af27e39`에서 이미 추가됐다. 정책은 **행이 남아 있는 타인 사진 파일**의 삭제를 거부하고, 행이 사라진 파일은 같은 그룹 멤버의 정리를 허용한다. 업로더 본인은 참조 행이 남아 있어도 파일을 직접 삭제할 수 있다. 따라서 §2 AC-1의 “orphan row가 발생할 수 없음”은 정책만으로 보장되지 않는다. 앱의 `deletePhotos`와 `deleteEvent`는 DB 행 삭제 후 Storage 삭제 순서이며 두 단계는 원자적이지 않다. 이 관찰 경계를 그대로 시험하고, 미검증 부분을 완료로 표기하지 않는다.
- §4 INFO 결정은 당시 판단으로 보존한다. §2 AC-3 원격 DB 드리프트는 운영 접근을 승인받지 않은 이번 로컬 QA 범위 밖이며 **미측정**이다. 로컬 마이그레이션 검사는 원격 드리프트의 증거가 아니다.
- 이번 변경은 로컬 계약·검증, trusted commitlint와 호환 의존성 갱신, 삭제 거부·부분 실패 처리 보정까지다. PR·병합·운영 적용은 수행하지 않는다. 로컬 결과와 다음 행동은 아래 표의 현재 후보·실행 기록으로 갱신한다.
- 삭제 함수 보정 후보는 DB 삭제의 반환 행을 확인한 뒤 그 행에 속한 사진 파일만 정리한다. 삭제된 행이 0건이면 파일에 손대지 않고 거부하며, 일부 행만 삭제됐거나 이후 Storage가 오류를 반환하면 `DeletePartialError`로 이미 반영된 DB 삭제를 화면에 전달한다. 사진 화면은 목록을 새로 읽고 부분 실패를 알리며, 기록 화면은 그룹 목록을 갱신하고 이미 삭제된 기록에서 이동한다. DB·Storage 사이의 원자성이나 자동 복구를 주장하지 않는다. 함수 단위 RED 5건→GREEN 7건과 실제 사용자 세션의 거부·UI 부분 실패 회귀를 각각 확인했다. 아래 원문 증거를 참조한다.

| 요구·위험 / 선정 이유                    | 조건·행동 / 환경                                                                | 기대 결과·판정자                                                                                                                                   | 관찰 경계                                                                                 | 필수 | 현재 판정                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---- | -------------------------------------------- |
| 개인 사진 삭제 / 행·파일 정합성          | 격리 로컬 Supabase에서 업로더가 실제 세션으로 자기 사진 행 삭제 후 Storage 제거 | 행 0개, 원본·썸네일 파일 0개. 실패 시 어느 단계까지 반영됐는지 구분                                                                                | 실제 Auth·PostgREST·Storage, service role은 합성 fixture 준비에만 사용                    | 예   | PASS — 실제 사용자 세션·행·파일 재조회       |
| 타인 사진 삭제 거부 / 멤버 권한          | 같은 그룹의 다른 멤버 세션으로 타인 사진 행·원본·썸네일 삭제 시도               | 각 삭제가 거부 또는 0건 처리되고 행·두 파일이 그대로 남음. 업로더 허용 사례와 쌍으로 판정                                                          | 실제 사용자 JWT·DB 재조회·Storage 다운로드                                                | 예   | PASS — 실제 사용자 세션·행·파일 재조회       |
| 행 삭제 뒤 Storage 부분 실패 / 고아 파일 | 행 삭제 뒤 Storage 요청이 실패하는 조건                                         | DB 행은 삭제된 채이고 파일은 남을 수 있음. 호출자에게 실패가 전달되는지 `deletePhotos`·`deleteEvent`별로 판정하고 자동 롤백·재시도를 주장하지 않음 | 실제 저장 결과와 함수 반환·UI 반응을 별도로 관찰                                          | 예   | PASS — 함수 실패·UI 반응·실제 잔여 파일 확인 |
| 기존 핵심 흐름 유지                      | Node 22, 새 의존성 설치 후 단위·형식·lint·build·Chromium e2e                    | 각 명령 exit 0, e2e 실패/재시도는 원인 해소 전 PASS로 간주하지 않음                                                                                | 현재 브랜치 작업트리와 로컬 Supabase, 기존 CI의 명령·설정                                 | 예   | PASS — 단위 86·브라우저 25, 재시도 0         |
| trusted commitlint / PR 코드 실행 위험   | 신뢰 기본 브랜치 SHA의 validator로 정상·부정 커밋 metadata를 검사               | 정상 통과, 잘못된 형식 거부; 기존 `commitlint` 워크플로 유지                                                                                       | canonical 파일 비교·Node 구문·로컬 validator 실행. GitHub required check 적용은 별도 단계 | 예   | 로컬 계약 PASS, 원격 CI UNVERIFIED           |

필수 항목의 실행 명령·cwd·후보·최초 실패·재시도 조건과 결과는 아래에 기록한다. 운영 DB·Storage는 검증에 사용하지 않는다.

첫 계약 후보 `b18f393`의 실행 기준은 `/Users/grinvi04/project/siku`의 `fix/harness-qa-contract` 작업트리(`origin/develop` 기준 `c7b5bbd`, 커밋 전)와 Node 22.18.0이다.

- `npm ci --no-audit --no-fund`: 원래 lockfile에서 exit 0. `npm audit --json`은 HIGH 7·CRITICAL 0. 공식 수정 범위의 `npm audit fix --no-fund` 후 `npm ci` 최초 재실행은 `Invalid: lock file's @emnapi/wasi-threads@1.2.1 does not satisfy @emnapi/wasi-threads@1.2.3` 등 선택 의존성 불일치로 exit 1. 깨끗한 작업 디렉터리에서 원본 `package.json`만으로 lockfile을 다시 해결한 다음 `npm ci --no-audit --no-fund` exit 0. 최종 `npm audit --json`은 전체 0건. 강제/메이저 업그레이드 없음.
- `npm run format:check`: 최초 `commitlint.config.cjs` 형식 경고로 exit 1. 해당 설정만 Prettier로 정리한 뒤 exit 0. `npm run lint`, `npm test`(6파일 79개), `npm run build`, `git diff --check`는 exit 0. `node --check` 검사기·설정 exit 0, 검사기 정상 메시지 허용/형식 오류 거부 확인. 원본 trusted workflow와 검사기 파일은 Harness 정본과 일치하며 설정은 서식만 다르다.
- 로컬 Supabase: npm 캐시의 macOS CLI는 공식 v2.107.0 릴리스 SHA-256과 일치하지만 `codesign --verify`가 `invalid signature (code or signature have been modified)`를 반환하고 실행은 `SIGKILL`됐다. 공식 Linux ARM64 v2.107.0 tarball은 릴리스 digest `d54648dd…21e0f`와 일치하고 격리 컨테이너에서 `--version`이 성공했다. `supabase start`는 `0017`까지 마이그레이션을 적용하고 exit 0이었다. 그러나 Docker의 실제 published HostIp는 API·DB 등에서 `0.0.0.0`/`[::]`였다. 즉시 `stop --no-backup` exit 0. 공식 문서의 loopback 바인딩 옵션을 가진 전용 Docker network로 재시도했으나 같은 바인딩이 관찰되어 다시 중지하고 전용 network를 제거했다. 기존 다른 프로젝트 컨테이너와 `.env`는 변경하지 않았다.
- `npx playwright test --list`는 합성 로컬 URL·키 환경변수로 새 2건 포함 전체 20건을 발견했고 exit 0이다. `npm run test:e2e`와 새 `tests/e2e/photo-policy.spec.ts`의 **실행은 미실행/UNVERIFIED**. 재개 조건은 모든 Supabase 공개 포트의 실제 Docker `HostIp`가 loopback인 격리 스택 또는 동등한 안전한 로컬 실행 환경 확보다. 공식 self-host Docker Compose의 시험 전용 사본에 합성 키와 명시적 `127.0.0.1` 포트를 쓰는 방식을 다음 후보로 검토할 수 있다. 그 뒤 실제 사용자 세션의 허용·거부·부분 실패와 기존 Chromium 흐름을 실행하고 최초 실패 및 재시도를 기록한다. `deletePhotos`·`deleteEvent`의 실패 반환·UI 반응 역시 현재 미관측이다. 운영 접근이 필요한 AC-3은 별도 승인·환경에서 수행할 미측정 항목이다.

위 첫 후보는 당시 필수 DB/Storage/e2e 미확인으로 `NOT VERIFIED`였다. 당시 미실행 기록을 후속 통과로 지우지 않는다.

### 후속: 실제 격리 스택과 삭제 처리 보정

- 공식 Supabase `self-hosted/v0.8.2`의 고정 커밋 `564eab8ad7840b13324f68b1bfac074ef8d51c21`에서 시험 전용 여섯 서비스 사본을 만들었다. 새 합성 키·DB만 사용했고 프로젝트 `.env`를 읽지 않는 Vite 설정을 사용했다. 실제 Docker 공개 포트는 게이트웨이 `127.0.0.1:15421` 하나뿐이며 나머지는 비공개다. 제품 마이그레이션 17개를 새 DB에 적용했다. 전역 Docker·OS 보안 설정은 바꾸지 않았다.
- 첫 전체 e2e는 기존 업로드 흐름의 파일 저장소 xattr 미지원과 새 정책 fixture의 PNG 형식 거부로 각각 실패하여 2 FAIL·11 NOT_RUN·12 PASS였다. 시험 전용 Docker 저장소로 바꾼 두 번째 시험은 새 사진 fixture가 bucket에서 금지한 PNG를 사용하여 1 FAIL·6 NOT_RUN·18 PASS였다. 정책을 완화하지 않고 유효한 WebP fixture로 바꾼 최종 시험은 **25 PASS·0 FAIL·재시도 0**이다. 실제 Auth·RLS·Storage의 허용/거부와 제품 삭제 함수·UI의 부분 실패 반응을 확인했다. Storage 403만 브라우저 경계에서 주입하며 DB 삭제와 잔여 파일을 실제 재조회했다.
- 새 `npm ci`·형식·lint·단위 **86개**·build·전체 `npm audit` **0건**은 원문 로그를 저장한 현재 시험에서 exit 0이다. 마지막 fixture 변경 뒤 형식·lint도 다시 통과했다. 삭제 단위 시험은 기존 구현에서 5/7 FAIL, 수정 후 7/7 PASS였다.
- 시험 후 합성 DB의 groups·photos·auth.users는 각각 0건이며 전용 여섯 컨테이너가 모두 중지됐다. Playwright 전용 `127.0.0.1:5173` 서버도 종료됐다. 원문·명령·cwd·최초 실패·재시도·소스/마이그레이션/환경 지문은 [QA 증거](harness-qa-contract-evidence.json)에 연결했다. 원문은 시험 당시 후보 증거이며 추후 변경 때 재사용 범위를 다시 대조해야 한다.
- 선정한 **로컬 QA는 PASS**, 고정 코드 후보 `5ad8a96`의 독립 읽기 전용 검토에서 기존 P2 해소·추가 P1/P2 없음과 실행/소스 지문 일치를 확인했다. 최초 실패의 원인 귀속 정정을 반영했고 문서 후보 `dde10ba`의 독립 재대조에서도 소스 지문 유지·기록 일치와 추가 P1/P2 없음이 확인됐다. 원격 CI/required-check 적용은 **UNVERIFIED**, PR·병합·배포는 **미실행**이다. §2 AC-3 원격 드리프트는 여전히 미측정이며 DB와 Storage 원자성은 보장하지 않는다. 다음 단계는 별도 원격 gate 인수이며, 로컬 시험 통과를 전체 도입·배포 완료로 확장하지 않는다.

## §7 원격 PR 인수와 첫 게이트 실패 (2026-10-07)

- 위 §6은 당시 로컬 후보의 실행 기록이다. `b6ed228`을 develop 대상 [PR #87](https://github.com/grinvi04/siku/pull/87)로 전달했다. 첫 required `repo-sync` 실행은 `commitlint.config.cjs`가 Harness main `9838c2ef`의 정본과 줄바꿈만 달라 FAIL이었다([실행 원문](https://github.com/grinvi04/siku/actions/runs/37620704260/job/112789954761)). commitlint 자체는 PASS였다.
- 정본 파일을 바이트 그대로 적용하고, 해당 파일에만 Prettier `printWidth: 90`을 지정했다. 이 값에서 정본과 Prettier 출력의 SHA-256이 일치하므로 두 게이트를 동시에 유지한다. 앱·검증 로직의 의미는 바꾸지 않았다. §6의 101개 입력 지문 중 이 설정 파일 하나는 변경되므로 그 전체 지문 일치 주장을 새 후보에 옮기지 않는다. 변경 없는 앱 입력과 기존 로컬 QA 원문은 해당 범위에 한해 재사용한다.
- 새 PR head의 필수 CI·Vercel 미리보기 결과는 [PR #87](https://github.com/grinvi04/siku/pull/87)의 현재 head SHA에서 확인한다. 이 기록은 최초 실패와 수정 이유를 보존하며, PR·CI를 병합·운영 배포 완료로 취급하지 않는다. 운영 DB 드리프트 미측정과 DB/Storage 비원자성 한계는 그대로다.

## §8 develop 병합 후 현행 판정 (2026-10-08)

- [PR #87](https://github.com/grinvi04/siku/pull/87)의 최종 head `dea999426959627ebcac169a615905e67cdfdb97`에서 develop 보호에 필요한 6개 검사(`quality`, `secret-scan`, `test-guard`, `commitlint`, `repo-sync`, `destructive-ddl`)가 모두 PASS였다. PR은 [병합 커밋 `92a929810c636aaec2670028a31566b50081811b`](https://github.com/grinvi04/siku/commit/92a929810c636aaec2670028a31566b50081811b)으로 develop에 반영됐다. §7의 첫 실패는 당시 결과로 유지한다.
- 최종 PR head의 Vercel Preview 배포는 SUCCESS였지만 비인증 URL은 로그인 화면으로 HTTP 302 이동해 앱 화면은 **UNVERIFIED**다. develop 병합은 main 릴리즈나 운영 반영의 증거가 아니다. main/default의 trusted 검사 전환은 별도 후속 단계이며 기존 보호 게이트를 유지한다.
- §6의 로컬 Auth·RLS·Storage 및 브라우저 25건 QA는 변경 없는 앱 입력에 한해 재사용한다. 운영 DB 마이그레이션 드리프트는 미측정이고 DB/Storage 삭제는 비원자적이다. 다음 단계는 별도 승인·환경에서 미리보기 앱 동작과 운영 경계를 검증하고, main 릴리즈 준비 시 보호 검사 전환과 배포 신선도를 별도로 판정하는 것이다. 원문·초기 실패·후속 근거는 [QA 증거](harness-qa-contract-evidence.json)와 [PR #87](https://github.com/grinvi04/siku/pull/87)에 연결한다.
