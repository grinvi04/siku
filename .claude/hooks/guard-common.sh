#!/bin/bash
# 공통 PreToolUse 가드 — 환경변수 TOOL, COMMAND를 전달받아 실행
# 직접 실행하지 말 것. 각 프로젝트의 guard-dangerous.sh에서 호출:
#   export TOOL COMMAND
#   bash "$HOME/project/harness/.claude/hooks/guard-common.sh"; [[ $? -eq 2 ]] && exit 2

if [[ "$TOOL" != "Bash" ]]; then exit 0; fi

# main/develop 직접 커밋 금지
if echo "$COMMAND" | grep -qE "\bgit\b.*\bcommit\b"; then
  BRANCH=$(git branch --show-current 2>/dev/null)
  if [[ "$BRANCH" == "main" || "$BRANCH" == "develop" ]]; then
    echo "⛔ [guard] main/develop 직접 커밋 금지"
    echo "   해결: feature/fix/hotfix/release 브랜치에서 작업 후 /feature-merge 사용"
    exit 2
  fi
fi

# main/develop force push 금지 (--force/-f 또는 +branch refspec)
if echo "$COMMAND" | grep -qE "git push.*(--force|-f)\b|git push.*\+(main|develop)\b"; then
  if echo "$COMMAND" | grep -qE "origin[[:space:]]+(main|develop)([[:space:]]|$)|:(main|develop)([[:space:]]|$)|\+(main|develop)([[:space:]]|$)"; then
    echo "⛔ [guard] main/develop force push 금지"
    echo "   해결: 브랜치 히스토리 변경이 필요하면 팀장에게 직접 요청하세요"
    exit 2
  fi
fi

# git reset --hard 금지
if echo "$COMMAND" | grep -qE "git reset --hard"; then
  echo "⛔ [guard] git reset --hard 금지 — 미커밋 변경사항 전체 삭제 위험"
  echo "   해결: 필요한 경우 사용자가 직접 실행 (Claude가 대신 실행하지 않음)"
  exit 2
fi

# 프로젝트 핵심 디렉터리 rm -rf 금지 (공통: PROJECT_ROOT, src, app, node_modules)
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [[ -n "$PROJECT_ROOT" ]] && echo "$COMMAND" | grep -qE "rm\s+-[rRf]{1,3}"; then
  if echo "$COMMAND" | grep -qE "(\"?$PROJECT_ROOT\"?[[:space:]]*$|(^|[[:space:]])(\./)?(src|app)(/|[[:space:]]|$)|node_modules[[:space:]]*$)"; then
    echo "⛔ [guard] 프로젝트 핵심 디렉터리 rm -rf 금지"
    echo "   해결: 삭제가 필요하면 사용자가 직접 실행하세요"
    exit 2
  fi
fi

# npm 글로벌 패키지 설치 금지
if echo "$COMMAND" | grep -qE "npm\s+install\s+(-g|--global)\b"; then
  echo "⛔ [guard] npm install -g 금지 — 글로벌 Node 환경 오염 위험"
  echo "   해결: 로컬 설치 사용 (npm install --save-dev 또는 npx)"
  exit 2
fi

exit 0
