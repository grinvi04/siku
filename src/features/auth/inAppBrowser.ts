/** 카카오톡 인앱브라우저 감지 — PWA 설치 불가 + 세션 격리 문제로 외부 브라우저 권장 */
export function isKakaoInAppBrowser(): boolean {
  return /KAKAOTALK/i.test(navigator.userAgent)
}

/** 카카오톡 인앱브라우저에서 현재 페이지를 기본 브라우저로 연다 */
export function openInExternalBrowser() {
  window.location.href =
    'kakaotalk://web/openExternal?url=' + encodeURIComponent(window.location.href)
}
