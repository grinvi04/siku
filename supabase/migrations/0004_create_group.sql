-- 0004_create_group.sql — 그룹 생성을 원자화 + 초대 코드 URL-safe화

-- 초대 코드가 URL 경로(/invite/:code)에 들어가므로 base64의 +, / 를 -, _ 로 치환
alter table groups
  alter column invite_code
  set default replace(replace(encode(gen_random_bytes(9), 'base64'), '+', '-'), '/', '_');

-- 그룹 생성 + owner 등록을 한 트랜잭션으로 (두 INSERT 사이 실패로 고아 그룹이 남지 않게)
create function create_group(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  gid uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception '모임 이름을 입력해 주세요.';
  end if;
  insert into groups (name, created_by) values (trim(p_name), auth.uid())
  returning id into gid;
  insert into group_members (group_id, user_id, role) values (gid, auth.uid(), 'owner');
  return gid;
end;
$$;
