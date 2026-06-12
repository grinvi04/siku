#!/bin/bash
# PreToolUse hook: siku 전용 가드
# 공통 가드(git flow·rm-rf·force-push·reset-hard·npm-global)와 시크릿 유출 탐지는
# harness-guard 플러그인이 담당한다 — 여기는 프로젝트 고유 규칙만.

INPUT=$(cat)

# 가드는 fail-closed — python3 부재 시 파싱 실패로 가드가 무력화되므로 차단
if ! command -v python3 >/dev/null 2>&1; then
  echo "⛔ [guard] python3 없음 — 가드 실행 불가 (fail-closed)" >&2
  exit 2
fi

TOOL=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_name',''))" 2>/dev/null)
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('command',''))" 2>/dev/null)

if [[ "$TOOL" != "Bash" ]]; then exit 0; fi

# Supabase 마이그레이션 파일 삭제 금지 (forward-only — AGENTS.md 도메인 규칙)
if echo "$COMMAND" | grep -qE "rm[[:space:]]+.*supabase/migrations"; then
  echo "⛔ [guard] 마이그레이션 파일 삭제 금지 — forward-only" >&2
  echo "   해결: 되돌리려면 새 버전의 마이그레이션 추가" >&2
  exit 2
fi

exit 0
