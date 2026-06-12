-- 시퀀스 권한 최소화 — 0015 후속 (0015는 v0.2.1로 릴리즈되어 수정 금지, forward-only)
--
-- 클라이언트 역할(anon/authenticated)의 시퀀스 권한을 USAGE만 남긴다:
-- - SELECT 회수: nextval/currval에는 USAGE로 충분, last_value 노출 불필요
-- - UPDATE 회수: 레거시 auto-grant(ALL)가 운영에 남긴 잔여 권한 — setval 오남용 방지
-- 본 프로젝트는 uuid PK라 시퀀스 의존이 사실상 없어 동작 영향 없음 (CI e2e가 검증).

revoke update, select on all sequences in schema public from anon, authenticated;

-- 향후 생성 시퀀스의 기본 권한도 USAGE만 (0015의 usage, select 선언에서 select 제거)
alter default privileges in schema public revoke update, select on sequences from anon, authenticated;
