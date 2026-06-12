---
description: 릴리즈 전 품질·보안 병렬 게이트 검증 (백엔드·프론트·보안)
---

# /release-check — 릴리즈 전 품질 검증 (병렬 게이트)

**사용법**: `/release-check`
배포 전 lint·test·build·보안을 한 번에 검증한다.

---

## 오케스트레이터 지시

아래 3개 에이전트를 **동시에** background로 spawn한다.

> ⚠️ **tier 분기**: backend-only 프로젝트는 Agent B(프론트엔드 품질)와 Agent C의 `<FRONTEND_DIR>` 항목을 제거하고 spawn한다 (존재하지 않는 디렉토리에서 돌면 실패). frontend-only는 반대로 Agent A·백엔드 항목 제거. fullstack만 3개 전부 실행.

### Agent A — 백엔드 품질 (`subagent_type: general-purpose`, `model: sonnet`, `run_in_background: true`)

다음을 순서대로 실행하고 결과를 리포트:
```bash
PROJECT_ROOT=$(git rev-parse --show-toplevel)
cd "$PROJECT_ROOT/<BACKEND_DIR>"
# <BACKEND_QUALITY_CMD>  예: npm run format && npm run lint:check && npm test
```
- lint 에러 수, 테스트 통과/실패 수 리포트
- 실패 항목은 파일명·라인 포함

### Agent B — 프론트엔드 품질 (`subagent_type: general-purpose`, `model: sonnet`, `run_in_background: true`)

다음을 순서대로 실행하고 결과를 리포트:
```bash
PROJECT_ROOT=$(git rev-parse --show-toplevel)
cd "$PROJECT_ROOT/<FRONTEND_DIR>"
# <FRONTEND_QUALITY_CMD>  예: npm run build && npx playwright test --reporter=line
```
- 빌드 에러, e2e 통과/실패 수 리포트

### Agent C — 보안 검토 (`subagent_type: security-reviewer`, `run_in_background: true`)

`.claude/agents/security-reviewer.md` 에이전트를 spawn한다 (model·tools·체크리스트는 에이전트 정의에 포함). 검토 대상 디렉토리만 전달한다: `<BACKEND_DIR>`, `<FRONTEND_DIR>`.

---

## 집계 (3개 에이전트 완료 후)

전체 결과를 표로 요약:
| 항목 | 결과 | 비고 |
|---|---|---|
| 백엔드 lint | ✅/❌ | |
| 백엔드 테스트 | ✅/❌ N개 통과 | |
| 프론트 빌드 | ✅/❌ | |
| e2e 테스트 | ✅/❌ | |
| 보안 이슈 | ✅ 없음 / ⚠️ N건 | |

위 항목이 **모두 ✅**이면 Agent D를 실행한다. 하나라도 ❌/⚠️이면 Agent D를 건너뛰고 "배포 준비 미완료" 출력 후 종료.

---

### Agent D — README 최신화 (`subagent_type: general-purpose`, `model: sonnet`, **순차 실행** — A/B/C 모두 ✅ 후에만)

**1. 현황 파악**
```bash
PROJECT_ROOT=$(git rev-parse --show-toplevel)
cat "$PROJECT_ROOT/README.md"
git log --oneline $(git describe --tags --abbrev=0 HEAD^)..HEAD
```

**2. README.md 업데이트 항목**
다음 항목만 수정한다 (그 외 섹션은 건드리지 않는다):
- 테스트 배지: 실제 통과 테스트 수로 교체
- 최근 변경사항 섹션: 마지막 태그 이후 feat/fix/perf 커밋 bullet (최대 5개)

**3. 커밋 & 머지**
```bash
PROJECT_ROOT=$(git rev-parse --show-toplevel)
cd "$PROJECT_ROOT"
git checkout develop
git checkout -b fix/readme-auto-update
git add README.md
git commit -m "docs(readme): 테스트 수·변경사항 자동 최신화 [release-check]

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git checkout develop
git merge --no-ff fix/readme-auto-update -m "Merge fix/readme-auto-update into develop"
git branch -d fix/readme-auto-update
git push origin develop
```

완료 후 "✅ README 최신화 완료" 출력.

---

### Agent E — CLAUDE.md 동기화 검증 (오케스트레이터 직접 실행 — Agent D 완료 후)

**1. 커맨드 목록 drift 확인**
```bash
PROJECT_ROOT=$(git rev-parse --show-toplevel)
MISSING=""
for cmd_file in "$PROJECT_ROOT/.claude/commands"/*.md; do
  cmd_name=$(basename "$cmd_file" .md)
  if ! grep -qE "/$cmd_name([^-]|$)" "$PROJECT_ROOT/CLAUDE.md"; then
    MISSING="$MISSING /$cmd_name"
  fi
done
if [[ -n "$MISSING" ]]; then
  echo "❌ CLAUDE.md 미반영 커맨드:$MISSING"
else
  echo "✅ CLAUDE.md 커맨드 목록 동기화됨"
fi
```

**2. drift 발견 시** CLAUDE.md 슬래시 커맨드 목록 업데이트 후 fix/claudemd-sync 브랜치에 커밋 → develop 머지.
drift 없으면 커밋 생략.

---

## 최종 집계 (Agent E 완료 후)

모두 ✅이면 "**배포 준비 완료**" 메시지 출력.
