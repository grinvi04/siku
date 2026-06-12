-- Data API 역할 권한 명시 — 스키마 자체 완결성
--
-- 클라우드 신규 기본값(auto-expose 제거, 2026-10-30 레거시 플래그 삭제 예정)과
-- 로컬 스택(CI e2e)에서는 새 엔티티에 자동 GRANT가 없다. 운영 프로젝트는 레거시
-- auto-grant로 동작해 왔으므로, 동일한 권한을 명시해 어느 환경에서든 마이그레이션만으로
-- 스키마가 재현되게 한다. 접근 제어는 RLS가 담당(0002), service_role은 RLS 우회(설계대로).
-- 운영에는 이미 같은 권한이 있어 본 마이그레이션은 사실상 no-op이다.

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

-- 0007_hardening의 명시적 축소를 재적용 — 위 일괄 GRANT가 되살리지 않도록
revoke execute on function increment_ocr_usage(uuid, date) from anon, authenticated;
