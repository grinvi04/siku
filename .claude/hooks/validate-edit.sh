#!/bin/bash
# PostToolUse hook: Edit/Write 후 lint · 테스트 검사 (siku 맞춤)
# exit 2 → Claude Code가 오류를 Claude에 전달 → 자동 수정 반복
#
# siku 구조: src/ = 프론트엔드 + 순수 로직(src/core), supabase/functions/ = Edge Function
# 단위 테스트: vitest, 파일 컨벤션 *.test.ts (sibling)

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d.get('tool_input', {}).get('file_path', ''))
" 2>/dev/null)

if [[ "$FILE_PATH" != *.ts && "$FILE_PATH" != *.tsx ]]; then
  exit 0
fi

PROJECT_ROOT=$(git -C "$(dirname "$FILE_PATH")" rev-parse --show-toplevel 2>/dev/null)
if [[ -z "$PROJECT_ROOT" ]]; then exit 0; fi

# ── src/ + supabase/functions/ — lint ────────────────────────────────
if [[ "$FILE_PATH" == "$PROJECT_ROOT/src/"* || "$FILE_PATH" == "$PROJECT_ROOT/supabase/functions/"* ]]; then
  cd "$PROJECT_ROOT"

  LINT_OUT=$(npx eslint "$FILE_PATH" --max-warnings 0 2>&1)
  if [ $? -ne 0 ]; then
    echo "❌ [lint 실패] $(basename "$FILE_PATH")"
    echo "$LINT_OUT"
    exit 2
  fi

  # 관련 단위 테스트 실행 (src/**/*.ts·*.tsx — sibling *.test.ts(x) 존재 시)
  if [[ "$FILE_PATH" == "$PROJECT_ROOT/src/"* && "$FILE_PATH" != *.test.ts && "$FILE_PATH" != *.test.tsx ]]; then
    BASE="${FILE_PATH%.tsx}"; BASE="${BASE%.ts}"
    for SPEC in "$BASE.test.ts" "$BASE.test.tsx"; do
      if [[ -f "$SPEC" ]]; then
        TEST_OUT=$(npx vitest run "$SPEC" 2>&1)
        if [ $? -ne 0 ]; then
          echo "❌ [테스트 실패] $(basename "$SPEC")"
          echo "$TEST_OUT"
          exit 2
        fi
      fi
    done
  fi

  # 테스트 파일 자체를 수정한 경우 그 테스트 실행
  if [[ "$FILE_PATH" == *.test.ts || "$FILE_PATH" == *.test.tsx ]]; then
    TEST_OUT=$(npx vitest run "$FILE_PATH" 2>&1)
    if [ $? -ne 0 ]; then
      echo "❌ [테스트 실패] $(basename "$FILE_PATH")"
      echo "$TEST_OUT"
      exit 2
    fi
  fi

  echo "✅ 통과: $(basename "$FILE_PATH")"
  exit 0
fi

exit 0
