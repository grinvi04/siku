-- 0011_settlement_closer.sql — 누가 정산을 확정했는지 기록

alter table settlements add column closed_by uuid references profiles (id);

create or replace function close_settlement(p_event_id uuid, p_transfers jsonb)
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

  if exists (select 1 from settlements where event_id = p_event_id and status = 'closed') then
    raise exception '이미 확정된 정산이 있습니다.';
  end if;

  insert into settlements (event_id, status, closed_by)
  values (p_event_id, 'closed', auth.uid())
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
