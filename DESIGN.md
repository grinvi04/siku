# 모임 Design System

> 소규모 모임의 기록·사진·정산을 위한 모바일 우선 PWA의 디자인 시스템.
> 돈이 오가는 앱이므로 신뢰감 있는 차분한 블루를 중심으로, 추억(사진·장소)에는
> 절제된 웜 톤을 포인트로 쓴다. 모든 색상·폰트는 자체 정의 또는 오픈 라이선스(OFL)로
> 저작권 문제가 없다.

## Colors

### Brand

- **Primary** (#2A5BD7): 핵심 CTA, 활성 상태, 링크. 신중하고 신뢰감 있는 딥 블루 — 정산·송금 등 돈과 관련된 행동의 기본색
- **Primary Pressed** (#1E46AC): Primary 버튼의 pressed/active 상태
- **Primary Container** (#EAF0FD): Primary 연한 배경 — 선택된 칩, 강조 영역, 내가 받을 금액 배경
- **Accent** (#E8865D): 따뜻한 포인트 — 사진·장소·추억 영역의 강조, 새 사진 배지. 과용 금지(화면당 1–2곳)
- **Accent Container** (#FCEEE6): Accent 연한 배경

### Neutral

- **Background** (#FFFFFF): 페이지 기본 배경 — 한국 모바일 앱 관례대로 순백 유지
- **Surface** (#F7F8FA): 카드·시트·입력 필드 배경
- **Border** (#E5E8EB): 구분선, 카드 테두리
- **Text Primary** (#1A202C): 제목·본문 — 순흑 대신 잉크 톤
- **Text Secondary** (#64707D): 보조 설명, 날짜, 메타 정보
- **Text Disabled** (#ADB5BD): 비활성 텍스트, placeholder

### Semantic

- **Receive** (#2A5BD7): 받을 돈 (Primary와 동일 — 긍정적 금액)
- **Pay** (#E03131): 낼 돈, 삭제·취소 등 파괴적 행동
- **Success** (#2F9E44): 송금 완료·수령 확인, 성공 토스트
- **Warning** (#F08C00): 정산 미완료 알림, 주의
- **Error** (#E03131): 오류 메시지, 검증 실패

다크 모드는 MVP 범위 밖 — 라이트 단일 테마.

## Typography

폰트: **Pretendard Variable** (SIL OFL 1.1 — 상업 사용·재배포 자유).
Fallback: `Pretendard Variable, Pretendard, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif`

한글 가독성을 위해 본문 16px 미만 금지, 행간은 한글 기준 1.5 이상.

- **Display**: 28px, Bold(700), line-height 1.35 — 정산 결과 총액 등 화면 1곳
- **Title**: 22px, Bold(700), line-height 1.4 — 화면 제목
- **Section**: 18px, SemiBold(600), line-height 1.45 — 카드·섹션 제목
- **Body**: 16px, Regular(400), line-height 1.55 — 본문 기본
- **Body Strong**: 16px, SemiBold(600) — 목록의 이름·금액
- **Caption**: 13px, Regular(400), line-height 1.5 — 날짜, 보조 설명 (Text Secondary 색)
- **Amount**: 금액 숫자는 모든 크기에서 `font-variant-numeric: tabular-nums` + SemiBold — 자릿수 정렬 유지

## Spacing

기본 단위 **4px**, 사용 스케일: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40.

- 화면 좌우 패딩: 20px
- 카드 내부 패딩: 16px
- 섹션 간 간격: 24px
- 목록 행 높이: 최소 56px (터치 타깃 44px 이상 보장)
- 하단 고정 버튼: safe-area inset + 16px

## Components

- **Primary Button**: bg Primary, 흰 텍스트 16px SemiBold, radius 12px, 높이 52px, 전체 폭. pressed 시 Primary Pressed. 비활성: bg #E5E8EB + Text Disabled
- **Secondary Button**: bg Primary Container, Primary 텍스트, 그 외 Primary Button과 동일
- **Text Button**: 배경 없음, Primary 텍스트 16px — 보조 행동(건너뛰기, 취소)
- **Input**: bg Surface, border 없음(포커스 시 1.5px Primary), radius 12px, 높이 52px, 내부 패딩 16px, placeholder는 Text Disabled. 레이블은 Caption 크기로 위에
- **Card**: bg Background, border 1px Border, radius 16px, 패딩 16px. 그림자 대신 테두리로 구분(Elevation 참조)
- **List Row**: 높이 56px+, 좌측 아바타/아이콘 40px, 우측 금액·체크. 행 사이 Border 1px 구분선
- **Bottom Navigation**: 높이 56px + safe-area, 활성 탭 Primary·비활성 Text Secondary, 라벨 11px
- **Chip**: 높이 36px, radius 18px(완전 원형), 선택 시 bg Primary Container + Primary 텍스트, 미선택 bg Surface — 정산 참여자 선택에 사용
- **Badge**: 정산 상태 표시 — `정산 전`(Surface/Text Secondary), `정산 중`(Warning 연한 배경), `정산 완료`(Success 연한 배경). 높이 24px, radius 6px, 12px SemiBold
- **Amount Display**: 받을 돈은 Receive 색 + `+` 접두, 낼 돈은 Pay 색 + `−` 접두, 원화는 `33,300원` 형식(콤마 + 원 접미사, ₩ 기호 미사용)
- **Photo Grid**: 3열, 2px 간격, radius 없음(그리드) / 단독 사진은 radius 12px
- **Toast**: 하단에서 16px 위, bg #1A202C 90%, 흰 텍스트 14px, radius 12px, 2.5초 자동 소멸

## Elevation

한국 모바일 앱 관례대로 그림자는 최소화하고 테두리·배경색 차이로 위계를 만든다.

- **Level 0**: 그림자 없음 — 기본. 카드도 테두리만
- **Level 1** (`0 2px 8px rgba(26,32,44,0.08)`): 바텀 시트, 드롭다운
- **Level 2** (`0 8px 24px rgba(26,32,44,0.16)`): 모달, 다이얼로그
- 하단 고정 CTA 영역: 그림자 대신 상단 1px Border + bg Background

## Guidelines

1. **신뢰가 먼저**: 금액·정산 관련 UI는 장식 없이 명확하게. 금액은 항상 tabular-nums, 받을 돈/낼 돈 색 구분을 일관되게
2. **따뜻함은 추억에만**: Accent(웜 톤)는 사진·장소·모임 기록 영역에만. 정산 화면에는 쓰지 않는다
3. **문구는 -해요체**: 간결한 한국어, 명령형 대신 권유형. 예: "정산을 확정할까요?" / 버튼은 명사형 또는 짧은 동사형("정산 확정", "사진 올리기")
4. **한 화면 한 행동**: 주요 행동은 하단 고정 Primary Button 1개. 위험 행동(정산 취소, 삭제)은 확인 다이얼로그 필수
5. **터치 우선**: 모든 인터랙티브 요소 최소 44×44px, 모서리 radius 12px 통일감 유지
6. **시스템 폰트 폴백 허용**: Pretendard 로딩 실패 시에도 레이아웃이 깨지지 않게 시스템 한글 폰트로 자연 폴백
7. **모션 최소화**: 페이지 전환·토스트 외 애니메이션 자제, `prefers-reduced-motion` 존중
