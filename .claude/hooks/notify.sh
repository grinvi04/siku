#!/bin/bash
# notify.sh — 크로스 플랫폼 완료 알림
# macOS / Linux / Windows(WSL) 모두 지원
# 알림 실패 시 조용히 무시 (exit 0) — 훅 전체를 깨지 않음

INPUT=$(cat)
TITLE="Claude Code"
MESSAGE="작업이 완료되었습니다"

case "$(uname -s)" in
  Darwin)
    # macOS
    osascript -e "display notification \"$MESSAGE\" with title \"$TITLE\" sound name \"Glass\"" 2>/dev/null || true
    ;;
  Linux)
    if [[ -n "$DISPLAY" || -n "$WAYLAND_DISPLAY" ]]; then
      # GUI Linux
      notify-send "$TITLE" "$MESSAGE" 2>/dev/null || true
    elif grep -qi microsoft /proc/version 2>/dev/null; then
      # WSL (Windows Subsystem for Linux)
      powershell.exe -Command "
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType=WindowsRuntime] | Out-Null
        \$template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
        \$template.GetElementsByTagName('text')[0].AppendChild(\$template.CreateTextNode('$TITLE')) | Out-Null
        \$template.GetElementsByTagName('text')[1].AppendChild(\$template.CreateTextNode('$MESSAGE')) | Out-Null
        \$notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Claude Code')
        \$notifier.Show([Windows.UI.Notifications.ToastNotification]::new(\$template))
      " 2>/dev/null || true
    fi
    ;;
  MINGW*|CYGWIN*|MSYS*)
    # Windows Git Bash
    powershell.exe -Command "
      Add-Type -AssemblyName System.Windows.Forms
      \$notify = New-Object System.Windows.Forms.NotifyIcon
      \$notify.Icon = [System.Drawing.SystemIcons]::Information
      \$notify.Visible = \$true
      \$notify.ShowBalloonTip(3000, '$TITLE', '$MESSAGE', [System.Windows.Forms.ToolTipIcon]::None)
    " 2>/dev/null || true
    ;;
esac

exit 0
