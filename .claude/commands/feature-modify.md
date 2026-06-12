---
description: TDD로 기존 기능 수정 — 변경분만 RED, 나머지 GREEN 유지
argument-hint: <feature-name> "<변경 설명>"
---

# /feature-modify — TDD 기반 기존 기능 수정

**사용법**: `/feature-modify <feature-name> "<변경 설명>"`
예) `/feature-modify chat "챗봇 응답에 출처 링크 포함"`

> 변경된 동작만 RED로 만들고, 나머지는 GREEN을 유지한 채 구현한다.

---

## Phase 0 — 진입 전 사전 점검 (오케스트레이터 직접 실행)

```bash
git checkout develop && git pull origin develop
```

spec 파일 존재 확인:
```bash
# ls <SPEC_PATH> 2>/dev/null || echo "⚠️ spec 파일 없음 — 테스트 없이 작성된 기능"
```
- spec 파일 없음 → Phase 2에서 새로 작성 (feature-add의 Phase 2 방식으로 전환)

---

## Phase 1 — 영향 범위 분석 (오케스트레이터 직접 실행)

$ARGUMENTS에서 도출:
- 수정 범위: 어떤 파일이 영향받는지
- 기존 테스트 중 변경 필요한 것 vs 유지되는 것
- DB 스키마 변경 필요 여부
- 브랜치 전략:
  - 기능 확장 → `feature/$FEATURE_NAME-update` → 커밋 타입 `feat`
  - 버그 수정 → `fix/$FEATURE_NAME` → 커밋 타입 `fix`

```bash
git checkout -b <결정된 브랜치명>
```

**분석 결과를 Phase 2 프롬프트에 명시적으로 포함한다.**

---

## Phase 2 — 테스트 계약 갱신 (`subagent_type: general-purpose`, `model: sonnet`, **foreground**)

**⚠️ 중요**: 변경된 테스트의 실패는 **의도된 RED 상태**이므로 수정하지 않는다.

**프롬프트 (Phase 1 분석 결과 포함):**

**작업 순서:**
1. spec 파일이 없었다면: feature-add Phase 2 방식으로 새로 작성
2. spec 파일이 있다면:
   - 변경되는 동작 → 기존 케이스 수정 또는 새 케이스 추가
   - 유지되는 동작 → 기존 테스트 그대로 보존
3. 실행 후 **변경된 테스트만 FAIL, 유지 테스트는 PASS** 확인:
   ```bash
   # <TEST_CMD> <spec파일>
   ```

완료 후 변경된 테스트 목록·RED 확인 결과 리포트.

---

## Phase 3 — 백엔드 수정 (`subagent_type: general-purpose`, `model: sonnet`, `run_in_background: true`)

**프롬프트 (Phase 1·2 결과 포함):**

**작업 순서:**
1. DB 스키마 변경이 필요하면 마이그레이션 실행
2. **구현 → 테스트 루프 (최대 3회)**:
   ```bash
   # <TEST_CMD> <spec파일>
   ```
   - 3회 모두 실패 시: 에러·수정 이력 리포트 후 **즉시 중단**

3. **회귀 검사**:
   ```bash
   # <BACKEND_QUALITY_CMD>
   ```
   - 기존 통과 테스트가 새로 실패하면 **회귀 발생** → 반드시 수정

완료 후 수정 파일 목록·전체 테스트 결과 리포트.
**Phase 3 완료 후 Phase 4를 실행한다.**

---

## Phase 4 — 프론트엔드 수정 (영향받는 경우에만, **Phase 3 완료 후 순차 실행**)

(`subagent_type: general-purpose`, `model: sonnet`, **foreground** — Phase 3 API 변경에 의존하므로 병렬 불가)

Phase 1 분석에서 프론트엔드 변경이 필요하다고 판단된 경우에만 실행.

**프롬프트 (Phase 3 변경 사항 포함):**
- **외과적 수정**: 변경 요청과 직접 관련된 파일만 수정

- **빌드 루프 (최대 3회)**:
  ```bash
  # <FRONTEND_BUILD_CMD>
  ```
  - 3회 모두 실패 시: 에러 리포트 후 **즉시 중단**

---

## Phase 5 — Refactor (오케스트레이터 직접 실행)

Phase 3·4 모두 ✅인 경우에만 진행.

수정된 코드 검토:
- 변경 요청 외 코드 수정 없는지 (외과적 원칙 위반)

수정 후 테스트 재확인:
```bash
# <TEST_CMD>
```

---

## Phase 6 — E2E 테스트 + 최종 검증 + 커밋 (오케스트레이터 직접 실행)

1. 변경된 동작에 대한 e2e 테스트 추가/수정
2. 최종 검증:
   ```bash
   # <FULL_QUALITY_CHECK_CMD>
   ```
3. 커밋 (Phase 1에서 결정한 타입 사용):
   ```bash
   git add <BACKEND_DIR>/ <FRONTEND_DIR>/
   git commit -m "<타입>($FEATURE_NAME): $DESCRIPTION

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
   ```

브랜치는 develop에 머지하지 않는다 — 사용자가 확인 후 `/feature-merge` 실행.

---

## Phase 7 — Act: 회고·개선 (오케스트레이터 직접 실행)

1. 영향 범위 분석이 실제 변경 범위와 일치했는가?
2. 회귀 테스트가 충분했는가?
3. 하네스 개선 제안 (CLAUDE.md 누락 패턴, 커맨드 흐름 개선 등)

의미있는 인사이트가 있으면 메모리에 저장:
```
/memory feedback: [인사이트 내용]
```
