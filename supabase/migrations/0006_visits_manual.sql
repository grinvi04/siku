-- 0006_visits_manual.sql — 수동 추가 장소는 좌표가 없을 수 있다

alter table visits alter column lat drop not null;
alter table visits alter column lng drop not null;
