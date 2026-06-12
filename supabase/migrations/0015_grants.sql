-- Data API 역할 권한 명시 — 스키마 자체 완결성 + 최소 권한
--
-- 클라우드 신규 기본값(auto-expose 제거)과 로컬 스택(CI e2e)에서는 새 엔티티에
-- 자동 GRANT가 없다. 어느 환경에서든 마이그레이션만으로 스키마가 재현되도록 명시하되,
-- 레거시 auto-grant(ALL)를 그대로 복제하지 않고 최소 권한으로 좁힌다:
-- 클라이언트 역할(anon/authenticated)은 RLS가 행 단위를 통제하는 DML만 —
-- TRUNCATE(RLS 미적용)·REFERENCES·TRIGGER는 클라이언트에 불필요하고 위험.
-- 운영에는 레거시 ALL이 이미 부여돼 있으므로 아래 REVOKE가 과잉 권한을 회수한다.

grant usage on schema public to anon, authenticated, service_role;

-- 클라이언트 역할: RLS 통제 하의 DML + RPC 실행만
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;

-- service_role: 관리 클라이언트(RLS 우회, Edge Function 전용) — 전체 권한
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

-- 운영의 레거시 auto-grant가 부여한 과잉 권한 회수 (최소 권한 정렬)
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;

-- 향후 생성 객체에도 같은 기준 적용
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;

-- 0007_hardening의 명시적 축소를 재적용 — 위 일괄 GRANT가 되살리지 않도록
revoke execute on function increment_ocr_usage(uuid, date) from anon, authenticated;
