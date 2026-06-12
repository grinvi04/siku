# CLAUDE.md

@AGENTS.md

## Claude Code 전용 지침

- `src/core/` 수정 시 vitest 단위 테스트를 먼저(또는 함께) 작성하고 통과까지 루프한다
- DB 변경은 migration 파일 추가로만 — 기존 migration 파일 수정 금지 (forward-only)

---

## 커맨드 강제 사용 규칙 (harness v1.6.0)

> **모든 작업 시작 전**: 어떤 슬래시 커맨드를 사용할지 먼저 선언하고 사용자 확인을 받을 것.

| 상황 | 커맨드 |
|---|---|
| 운영 중 긴급 버그 (main 기준) | `/hotfix <name> "<증상>"` |
| 신규 기능 개발 (develop 기준) | `/feature-add <name> "<설명>"` |
| 기존 기능 변경 (develop 기준) | `/feature-modify <name> "<설명>"` |
| feature 브랜치 → develop 머지 | `/feature-merge` |
| 릴리즈 전 검증 | `/release-check` |
| 릴리즈 실행 | `/release <version>` |
| `.claude/`·설정 파일 변경 | `/feature-modify <name> "<설명>"` |

### ⛔ 커맨드 우회 금지

커맨드를 실행할 때는 커맨드 파일의 Phase 순서, 서브에이전트 spawn, 검증 게이트를 정확히 따른다.

- 커맨드 파일을 직접 읽고 임의로 재해석하거나 단계를 생략해서는 안 된다
- 서브에이전트가 파일을 수정할 때 `validate-edit.sh` 훅이 트리거되지 않는다 → 구현 완료 후 반드시 `npm run lint && npm test`를 직접 실행한다
- 해당 커맨드가 존재하는데 Bash로 직접 우회하는 것은 하네스 위반이다

---

## Git Flow

| 브랜치 | 직접 커밋 |
|---|---|
| `main`, `develop` | ❌ **절대 금지 — 배포 크래시, 긴급 버그 등 어떤 상황도 예외 없음** |
| `feature/*`, `fix/*`, `hotfix/*`, `release/*` | ✅ |

**기능 개발**: `develop → feature/xxx → PR → develop`
**긴급 수정**: `develop → fix/xxx → PR → develop` (배포 중 버그 등 포함)
**운영 핫픽스**: `main → hotfix/xxx → PR → main (tag) + develop`
**릴리즈**: `develop → release/vX.X.X → PR → main (tag) + develop`

> ⛔ "빠르게 해야 한다", "작은 수정이다", "긴급하다" — 모두 브랜치를 건너뛸 이유가 되지 않는다.

---

## 커밋 메시지 형식

```
타입(범위): 제목

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

타입: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

---

## Compact Instructions

컨텍스트 압축 후에도 반드시 유지해야 할 핵심 규칙:

1. **슬래시 커맨드 강제**: 파일 수정·git 작업 전 반드시 해당 커맨드 선언 후 사용자 확인. 예외 없음.
2. **Git Flow**: `main`, `develop` 직접 커밋 절대 금지. 반드시 feature/fix/hotfix/release 브랜치 → PR 경유.
3. **커맨드 우회 금지**: 커맨드 파일의 Phase 순서·서브에이전트·검증 게이트를 정확히 따른다.
4. **서브에이전트 검증 누락 보완**: 서브에이전트가 파일 수정 시 hook이 트리거되지 않으므로 구현 완료 후 반드시 `npm run lint && npm test` 직접 실행.
5. **src/core/ 순수성**: 브라우저/플랫폼 API import 금지, 변경 시 단위 테스트 동반.
