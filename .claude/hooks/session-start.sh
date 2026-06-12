#!/bin/bash
# SessionStart hook: 세션 시작 시 하네스 버전 + validate-edit 설정 + 배포 도구 확인

PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [[ -z "$PROJECT_ROOT" ]]; then exit 0; fi

# ── 하네스 버전 확인 ──────────────────────────────────────────────────
HARNESS_VERSION_FILE="$PROJECT_ROOT/.claude/HARNESS_VERSION"
HARNESS_LATEST_FILE="$HOME/project/harness/VERSION"
if [[ -f "$HARNESS_VERSION_FILE" ]]; then
  PROJ_HARNESS_VER=$(cat "$HARNESS_VERSION_FILE")
  if [[ -f "$HARNESS_LATEST_FILE" ]]; then
    LATEST_VER=$(cat "$HARNESS_LATEST_FILE")
    if [[ "$PROJ_HARNESS_VER" != "$LATEST_VER" ]]; then
      echo "⚠️  하네스 버전 불일치: 프로젝트 v$PROJ_HARNESS_VER / 최신 v$LATEST_VER"
      echo "   /harness-sync-check 실행 후 업데이트하세요"
    else
      echo "🔧 하네스 v$PROJ_HARNESS_VER ✅"
    fi
  else
    echo "🔧 하네스 v$PROJ_HARNESS_VER"
  fi
fi

# ── validate-edit.sh 미설정 감지 ──────────────────────────────────────
VALIDATE_EDIT="$PROJECT_ROOT/.claude/hooks/validate-edit.sh"
if [[ -f "$VALIDATE_EDIT" ]] && grep -q "CONFIGURE_ME" "$VALIDATE_EDIT" 2>/dev/null; then
  echo "⚠️  validate-edit.sh 미설정 — .claude/hooks/validate-edit.sh 변수를 수정하세요"
fi

# ── Java 버전 확인 (Java 프로젝트만) ─────────────────────────────────
if [[ -f "$PROJECT_ROOT/build.gradle" || -f "$PROJECT_ROOT/build.gradle.kts" || -f "$PROJECT_ROOT/pom.xml" ]]; then

  # 현재 JDK 버전
  JAVA_CURRENT=""
  if command -v java &>/dev/null; then
    raw=$(java -version 2>&1 | grep -oE '"[0-9]+[._][0-9]+' | grep -oE '[0-9]+[._][0-9]+' | head -1)
    if [[ "$raw" == "1."* ]]; then
      JAVA_CURRENT="${raw#1.}"; JAVA_CURRENT="${JAVA_CURRENT%%.*}"
    else
      JAVA_CURRENT="${raw%%.*}"
    fi
  fi

  # 프로젝트 요구 버전 (빌드 파일에서 추출)
  JAVA_REQUIRED=""
  if [[ -f "$PROJECT_ROOT/pom.xml" ]]; then
    raw=$(grep -E "<java\.version>|<maven\.compiler\.source>" "$PROJECT_ROOT/pom.xml" 2>/dev/null \
          | grep -oE '1\.[0-9]+|[0-9]{2,}' | head -1)
    if [[ "$raw" == "1."* ]]; then JAVA_REQUIRED="${raw#1.}"; else JAVA_REQUIRED="$raw"; fi
  elif [[ -f "$PROJECT_ROOT/build.gradle" || -f "$PROJECT_ROOT/build.gradle.kts" ]]; then
    raw=$(grep -E "sourceCompatibility|languageVersion|VERSION_" \
          "$PROJECT_ROOT"/build.gradle "$PROJECT_ROOT"/build.gradle.kts 2>/dev/null \
          | grep -oE '1\.[0-9]+|[0-9]{2,}' | head -1)
    if [[ "$raw" == "1."* ]]; then JAVA_REQUIRED="${raw#1.}"; else JAVA_REQUIRED="$raw"; fi
  fi

  # 결과 출력
  if [[ -z "$JAVA_CURRENT" ]]; then
    echo "⚠️  Java: java 명령어 없음 — JDK 설치 및 PATH 확인 필요"
  elif [[ -z "$JAVA_REQUIRED" ]]; then
    echo "☕ Java $JAVA_CURRENT (빌드 파일에서 요구 버전 미감지)"
  elif [[ "$JAVA_CURRENT" -lt "$JAVA_REQUIRED" ]]; then
    echo "❌ Java 버전 불일치: 현재 Java $JAVA_CURRENT / 프로젝트 요구 Java $JAVA_REQUIRED"
    echo "   컴파일 및 테스트가 실패합니다. JDK $JAVA_REQUIRED 이상 설치 필요."
  elif [[ "$JAVA_CURRENT" -gt "$JAVA_REQUIRED" ]]; then
    echo "☕ Java $JAVA_CURRENT (요구: $JAVA_REQUIRED) — 상위 버전, 대부분 정상"
  else
    echo "☕ Java $JAVA_CURRENT ✅"
  fi
  echo ""
fi

# ── 배포 도구 연결 확인 ───────────────────────────────────────────────
# 사용하는 배포 도구로 교체:
# 예시 A: Vercel
# VERCEL_USER=$(vercel whoami 2>/dev/null)
# [[ -n "$VERCEL_USER" ]] && echo "▲ Vercel: $VERCEL_USER" || echo "⚠️  Vercel 미인증"

# 예시 B: Railway
# railway status 2>&1 | grep -q "Project:" && echo "🚂 Railway: 연결됨" || echo "⚠️  Railway 미연결"

# 예시 C: Docker 서비스
# docker-compose ps 2>/dev/null | grep -q "Up" && echo "🐳 Docker: 실행 중" || echo "⚠️  Docker 서비스 미실행"

# ── 커맨드 목록 drift 감지 ────────────────────────────────────────────
COMMANDS_DIR="$PROJECT_ROOT/.claude/commands"
if [[ -d "$COMMANDS_DIR" ]]; then
  MISSING=""
  for cmd_file in "$COMMANDS_DIR"/*.md; do
    [[ -e "$cmd_file" ]] || continue
    cmd_name=$(basename "$cmd_file" .md)
    grep -qE "/$cmd_name([^-]|$)" "$PROJECT_ROOT/CLAUDE.md" 2>/dev/null || MISSING="$MISSING /$cmd_name"
  done
  if [[ -n "$MISSING" ]]; then
    echo "⚠️  CLAUDE.md 커맨드 목록 미반영:$MISSING"
  else
    echo "✅ CLAUDE.md 커맨드 목록 동기화됨"
  fi
fi

echo ""
