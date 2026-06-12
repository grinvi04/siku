#!/bin/bash
# PreToolUse hook: 위험 명령 사전 차단
# 공통 가드는 guard-common.sh에 위임; 이 파일은 언어별 추가 가드만 유지

INPUT=$(cat)

# 가드는 fail-closed — python3 부재 시 파싱 실패로 가드가 무력화되므로 차단
if ! command -v python3 >/dev/null 2>&1; then
  echo "⛔ [guard] python3 없음 — 가드 실행 불가 (fail-closed)"
  exit 2
fi

TOOL=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_name',''))" 2>/dev/null)
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('command',''))" 2>/dev/null)

if [[ "$TOOL" != "Bash" ]]; then exit 0; fi

# 공통 가드 (git flow·rm-rf·force-push·reset-hard·npm-global)
# 정상 종료는 0(통과)/2(차단)뿐 — 126/127 등 실행 실패도 fail-closed로 차단
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export TOOL COMMAND
bash "$SCRIPT_DIR/guard-common.sh"
RC=$?
if [[ $RC -ne 0 ]]; then
  [[ $RC -ne 2 ]] && echo "⛔ [guard] guard-common.sh 실행 실패 (exit $RC) — fail-closed 차단"
  exit 2
fi

# ── 언어별 추가 가드 예시 (주석 해제하여 사용) ───────────────────────────

# Python: 시스템 pip 금지
# if echo "$COMMAND" | grep -qE "(^|&&|\|)\s*pip(3)?\s+install\b" && ! echo "$COMMAND" | grep -qE "\.venv/bin/pip"; then
#   echo "⛔ [guard] 시스템 pip install 금지 — 가상환경 오염 위험"
#   echo "   해결: .venv/bin/pip install 사용"
#   exit 2
# fi

# DB: 전체 초기화 금지
# if echo "$COMMAND" | grep -qE "prisma migrate reset|alembic downgrade base|DROP DATABASE"; then
#   echo "⛔ [guard] DB 전체 초기화 금지"
#   echo "   해결: 필요하면 사용자가 직접 실행하세요"
#   exit 2
# fi

# ── Java / Spring Boot 가드 ───────────────────────────────────────────

# 테스트 스킵 금지 (-DskipTests, -x test, --skip-tests)
if echo "$COMMAND" | grep -qE "\-DskipTests|\-x\s+test\b|--skip-tests"; then
  echo "⛔ [guard] 테스트 스킵 금지"
  echo "   해결: 테스트 실패 원인을 수정하세요"
  echo "   예외가 필요하면 사용자가 직접 실행하세요"
  exit 2
fi

# prod 프로파일 로컬 실행 금지
if echo "$COMMAND" | grep -qE "\-Dspring\.profiles\.active=(prod|production)\b"; then
  echo "⛔ [guard] prod 프로파일 로컬 실행 금지 — 운영 DB 연결 위험"
  echo "   해결: -Dspring.profiles.active=local 또는 dev 사용"
  exit 2
fi

# Spring Security 런타임 비활성화 금지
if echo "$COMMAND" | grep -qE "\-Dspring\.security\.enabled=false|\-Dsecurity\.enabled=false"; then
  echo "⛔ [guard] Spring Security 런타임 비활성화 금지"
  echo "   해결: 테스트에서 보안 우회는 @WithMockUser 또는 @WithAnonymousUser 사용"
  exit 2
fi

# Flyway / Liquibase 마이그레이션 파일 삭제 금지
if echo "$COMMAND" | grep -qE "rm\s+.*V[0-9]+__.*\.(sql|xml)|rm\s+.*db/migration|rm\s+.*changelog"; then
  echo "⛔ [guard] 마이그레이션 파일 삭제 금지"
  echo "   마이그레이션 파일을 지우면 새 환경에서 DB 재현이 불가능합니다"
  echo "   해결: 되돌리려면 새 버전의 마이그레이션 추가 → /migration-add 사용"
  exit 2
fi

exit 0
