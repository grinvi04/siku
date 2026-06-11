# CLAUDE.md

@AGENTS.md

## Claude Code 전용 지침

- `src/core/` 수정 시 vitest 단위 테스트를 먼저(또는 함께) 작성하고 통과까지 루프한다
- DB 변경은 migration 파일 추가로만 — 기존 migration 파일 수정 금지 (forward-only)
