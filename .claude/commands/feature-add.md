---
description: TDD로 신규 기능 개발 — 브랜치→테스트계약→병렬구현→검증→커밋
argument-hint: <feature-name> "<설명>"
---

# /feature-add — TDD 기반 신규 기능 개발

**사용법**: `/feature-add <feature-name> "<설명>"`
예) `/feature-add bookmark "가이드 북마크 저장 기능"`

> Red → Green → Refactor. 테스트가 구현보다 먼저 존재한다.

---

## Phase 0 — 진입 전 사전 점검 (오케스트레이터 직접 실행)

```bash
git checkout develop && git pull origin develop
# 모듈 중복 확인 — 이미 존재하면 /feature-modify 사용
# ls <BACKEND_DIR>/src/$FEATURE_NAME/ 2>/dev/null && echo "⛔ 이미 존재. /feature-modify 사용" && exit 1
git checkout -b feature/$FEATURE_NAME
```

---

## Phase 1 — 요구사항 분석 + 영향 범위 파악 (오케스트레이터 직접 실행)

$ARGUMENTS에서 도출:
- API 엔드포인트, 요청/응답 형태, 비즈니스 규칙 (정상·예외·경계값)
- 프론트엔드 페이지/컴포넌트 구조

영향 범위 확인:
- 재사용할 기존 서비스·유틸
- DB 스키마 변경 필요 여부 → 필요하면 Phase 3에서 마이그레이션 실행

**Cross-domain 체크리스트 (Phase 1에서 반드시 확인):**
- [ ] 새 에러 유형을 발생시키는가? → 중앙 에러 핸들러(미들웨어/예외 핸들러)에 대응 처리가 있는지 확인
- [ ] 특정 역할(admin 등) 전용 기능인가? → 인가(Authorization) 레이어에서 접근 제어가 적용되는지 확인
- [ ] 다른 도메인 데이터에 영향을 주는 side effect가 있는가? → 연관 도메인 상태까지 동기화되는지 확인 (예: A를 처리하면 B도 변경되어야 함)
- [ ] 외부 입력을 받는 필드가 있는가? → 입력값 검증(validation)이 적절히 적용되는지 확인
- [ ] HTTP/API 응답 코드가 의미에 맞는가? → 성공/실패/권한 오류 코드가 명세와 일치하는지 확인

위 항목 중 하나라도 해당하면 Phase 2 전에 설계에 반영한다.

**분석 결과를 Phase 2 프롬프트에 명시적으로 포함한다. Phase 2는 $ARGUMENTS만으로 컨텍스트를 추론하지 않는다.**

---

## Phase 2 — 테스트 계약 작성 (`subagent_type: general-purpose`, `model: sonnet`, **foreground**)

> "테스트는 코드의 명세다." — 구현 없이 기대 동작을 완전히 기술한다.

**⚠️ 중요**: spec 파일 저장 시 PostToolUse hook이 테스트를 실행해 `❌ 테스트 실패`를 출력한다. 이것은 **의도된 RED 상태**이므로 수정하지 않는다.

**프롬프트 (Phase 1 분석 결과 포함):**
- 기능명·DTO·비즈니스 규칙: [Phase 1 결과 붙여넣기]

**작업 순서:**
1. 빈 stub 먼저 생성 (import 오류 방지)
2. spec/test 파일 작성:
   - 정상 경로 — 반환값·호출 여부 검증
   - 모든 예외 경로
   - 경계값 — 빈 배열, 중복 ID, null 입력
3. 실행 후 **전부 FAIL 확인**:
   ```bash
   # <TEST_CMD> <spec파일>
   ```

완료 후 spec 파일 경로·테스트 목록·RED 확인 결과 리포트.
**Phase 2 완료 후 Phase 3·4를 병렬로 spawn한다.**

---

## Phase 3 — 백엔드 구현 (`subagent_type: general-purpose`, `model: sonnet`, `run_in_background: true`)

**프롬프트 (Phase 1 분석 결과 포함):**
- Phase 2 spec을 **계약서**로 삼아 구현

**작업 순서:**
1. DB 스키마 변경이 필요하면 마이그레이션 실행
2. stub을 실제 구현으로 교체

3. **구현 → 테스트 루프 (최대 3회)**:
   ```bash
   # <TEST_CMD> <spec파일>
   ```
   - 3회 모두 실패 시: 에러·수정 이력 리포트 후 **즉시 중단**

4. 회귀 검사:
   ```bash
   # <BACKEND_QUALITY_CMD>
   ```

완료 후 생성 파일 목록·테스트 결과 리포트.

---

## Phase 4 — 프론트엔드 구현 (`subagent_type: general-purpose`, `model: sonnet`, `run_in_background: true`)

**프롬프트 (Phase 1 API 계약 포함):**
- Phase 1 API 계약 기준으로 구현

- **빌드 루프 (최대 3회)**:
  ```bash
  # <FRONTEND_BUILD_CMD>
  ```
  - 3회 모두 실패 시: 에러 리포트 후 **즉시 중단**

완료 후 생성 파일 목록·빌드 결과 리포트.

---

## Phase 5 — Refactor (오케스트레이터 직접 실행)

Phase 3·4 모두 ✅인 경우에만 진행.

코드 품질 검토 (`<BACKEND_CLAUDE_MD>` 기준):
- 불필요한 any 타입, 과도한 책임, 중복 로직

수정 후 테스트 재확인:
```bash
# <TEST_CMD>
```

---

## Phase 6 — E2E 테스트 추가 + 최종 검증 + 커밋 (오케스트레이터 직접 실행)

1. e2e 테스트 작성 (핵심 시나리오 1~3개)
2. 최종 검증:
   ```bash
   # <FULL_QUALITY_CHECK_CMD>
   ```
3. 커밋:
   ```bash
   git add <BACKEND_DIR>/ <FRONTEND_DIR>/
   git commit -m "feat($FEATURE_NAME): $DESCRIPTION

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
   ```

브랜치는 develop에 머지하지 않는다 — 사용자가 확인 후 `/feature-merge` 실행.

---

## Phase 7 — Act: 회고·개선 (오케스트레이터 직접 실행)

아래 항목을 간략히 검토하고, 의미있는 인사이트만 기록한다:

1. 테스트 계약이 구현 방향을 충분히 명확하게 했는가?
2. 구현 루프에서 반복된 오류 패턴이 있었는가?
3. 하네스 개선 제안 (CLAUDE.md 누락 패턴, validate-edit.sh 보강 등)

의미있는 인사이트가 있으면 Write 툴로 메모리 파일에 직접 저장한다:

**저장 경로**: `~/.claude/projects/<프로젝트-경로>/memory/feedback-<slug>.md`
(예: `~/.claude/projects/<프로젝트>/memory/feedback-feature-add-lesson.md`)

**파일 형식**:
```markdown
---
name: feedback-<slug>
description: <한 줄 요약 — 미래 대화에서 관련성을 판단할 수 있도록 구체적으로>
metadata:
  type: feedback
---

[인사이트 내용]

**Why:** [이유]
**How to apply:** [적용 기준]
```

저장 후 같은 경로의 `MEMORY.md` 인덱스에 한 줄 포인터를 추가한다:
```
- [제목](feedback-<slug>.md) — 한 줄 요약
```

인사이트가 없으면 생략한다.
