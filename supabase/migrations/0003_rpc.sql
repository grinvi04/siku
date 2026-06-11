-- 0003_rpc.sql — RLS로 풀 수 없는 흐름은 RPC(SECURITY DEFINER)로

-- 초대 미리보기: 비멤버도 그룹 이름·인원만 확인 (로그인 필요)
create function get_invite_preview(p_invite_code text)
returns table (group_id uuid, name text, member_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select g.id, g.name, count(m.user_id)
  from groups g
  left join group_members m on m.group_id = g.id
  where g.invite_code = p_invite_code and auth.uid() is not null
  group by g.id, g.name;
$$;

-- 초대 코드로 가입 (이미 멤버면 no-op)
create function join_group(p_invite_code text)
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
  select id into gid from groups where invite_code = p_invite_code;
  if gid is null then
    raise exception '유효하지 않은 초대 코드입니다.';
  end if;
  insert into group_members (group_id, user_id, role)
  values (gid, auth.uid(), 'member')
  on conflict (group_id, user_id) do nothing;
  return gid;
end;
$$;

-- 정산 확정: 이체 목록은 클라이언트(core/settlement, 단위 테스트됨)가 계산해 전달.
-- 서버는 멤버십·무결성(참가자 여부, 양수 금액)과 원자성을 보장한다.
-- p_transfers: [{ "from_user": uuid, "to_user": uuid, "amount": int }, ...]
create function close_settlement(p_event_id uuid, p_transfers jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  t record;
begin
  if not is_group_member(event_group(p_event_id)) then
    raise exception '그룹 멤버가 아닙니다.';
  end if;

  -- 동시 확정 경합 방지: unique partial index가 최종 방어선
  if exists (select 1 from settlements where event_id = p_event_id and status = 'closed') then
    raise exception '이미 확정된 정산이 있습니다.';
  end if;

  insert into settlements (event_id, status) values (p_event_id, 'closed')
  returning id into sid;

  for t in
    select (e->>'from_user')::uuid as from_user,
           (e->>'to_user')::uuid   as to_user,
           (e->>'amount')::integer as amount
    from jsonb_array_elements(p_transfers) e
  loop
    if t.amount <= 0 or t.from_user = t.to_user then
      raise exception '잘못된 이체 항목입니다.';
    end if;
    -- 결제자는 참여자가 아닐 수 있으므로 그룹 멤버 기준으로 검증
    if not exists (select 1 from group_members
                   where group_id = event_group(p_event_id)
                     and user_id in (t.from_user, t.to_user)
                   having count(*) = 2) then
      raise exception '이체 당사자가 그룹 멤버가 아닙니다.';
    end if;
    insert into settlement_transfers (settlement_id, from_user, to_user, amount)
    values (sid, t.from_user, t.to_user, t.amount);
  end loop;

  return sid;
end;
$$;

-- 정산 취소: closed → reopened (이체 기록은 이력으로 보존,
-- confirmed 이체는 다음 확정 때 클라이언트가 선지급으로 차감)
create function reopen_settlement(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not is_group_member(event_group(p_event_id)) then
    raise exception '그룹 멤버가 아닙니다.';
  end if;
  update settlements
  set status = 'reopened', reopened_at = now()
  where event_id = p_event_id and status = 'closed';
  get diagnostics n = row_count;
  if n = 0 then
    raise exception '확정된 정산이 없습니다.';
  end if;
end;
$$;
