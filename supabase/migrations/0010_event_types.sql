-- 0010_event_types.sql — 모임 종류 확장 (서로 겹치지 않는 6종)
-- lunch 점심모임 / dinner 저녁모임 / snack 간식·카페 / ride 라이딩 / outing 나들이(당일) / trip 여행(숙박)

alter table events drop constraint events_type_check;
alter table events add constraint events_type_check
  check (type in ('lunch', 'dinner', 'snack', 'ride', 'outing', 'trip'));
