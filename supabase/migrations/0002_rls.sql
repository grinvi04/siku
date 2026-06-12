-- 0002_rls.sql — RLS 정책 + 확정 잠금 트리거

-- 멤버십 헬퍼: SECURITY DEFINER로 group_members 정책의 자기참조 재귀를 차단
create function is_group_member(gid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

create function event_group(eid uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select group_id from events where id = eid;
$$;

alter table profiles enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table events enable row level security;
alter table event_participants enable row level security;
alter table visits enable row level security;
alter table photos enable row level security;
alter table expenses enable row level security;
alter table expense_participants enable row level security;
alter table settlements enable row level security;
alter table settlement_transfers enable row level security;

-- profiles: 본인 + 같은 그룹 멤버 조회 가능 (정산·갤러리에 타인 이름·계좌 필요)
create policy profiles_select on profiles for select using (
  id = auth.uid()
  or exists (
    select 1 from group_members me
    join group_members them on them.group_id = me.group_id
    where me.user_id = auth.uid() and them.user_id = profiles.id
  )
);
create policy profiles_insert on profiles for insert with check (id = auth.uid());
create policy profiles_update on profiles for update using (id = auth.uid());

-- groups: 멤버만 조회. 생성은 본인 명의. 수정은 owner. 가입은 join_group RPC 경유.
create policy groups_select on groups for select using (is_group_member(id));
create policy groups_insert on groups for insert with check (created_by = auth.uid());
create policy groups_update on groups for update using (
  exists (select 1 from group_members
          where group_id = id and user_id = auth.uid() and role = 'owner')
);

-- group_members: 같은 그룹 멤버 조회. INSERT는 그룹 생성자의 owner 셀프 등록만
-- (초대 가입은 join_group RPC가 SECURITY DEFINER로 수행)
create policy group_members_select on group_members for select using (is_group_member(group_id));
create policy group_members_insert on group_members for insert with check (
  user_id = auth.uid() and role = 'owner'
  and exists (select 1 from groups where id = group_id and created_by = auth.uid())
);
-- 탈퇴: 본인 행 삭제 (open 정산 차단은 클라이언트 + 추후 필요 시 트리거)
create policy group_members_delete on group_members for delete using (user_id = auth.uid());

-- events: 그룹 멤버 전체 조회·생성·수정
create policy events_select on events for select using (is_group_member(group_id));
create policy events_insert on events for insert with check (
  is_group_member(group_id) and created_by = auth.uid()
);
create policy events_update on events for update using (is_group_member(group_id));
create policy events_delete on events for delete using (
  created_by = auth.uid()
  or exists (select 1 from group_members
             where group_id = events.group_id and user_id = auth.uid() and role = 'owner')
);

-- event_participants: 멤버 조회, 멤버가 참가자 추가/제거 (소규모 신뢰 기반)
create policy event_participants_select on event_participants for select
  using (is_group_member(event_group(event_id)));
create policy event_participants_insert on event_participants for insert
  with check (is_group_member(event_group(event_id)));
create policy event_participants_delete on event_participants for delete
  using (is_group_member(event_group(event_id)));

-- visits: 멤버 누구나 조회·생성·수정 (자동 인식 결과 승인/수정 기능)
create policy visits_select on visits for select using (is_group_member(event_group(event_id)));
create policy visits_insert on visits for insert with check (is_group_member(event_group(event_id)));
create policy visits_update on visits for update using (is_group_member(event_group(event_id)));
create policy visits_delete on visits for delete using (is_group_member(event_group(event_id)));

-- photos: 멤버 조회, 업로드는 본인 명의, 수정·삭제는 업로더만
create policy photos_select on photos for select using (is_group_member(event_group(event_id)));
create policy photos_insert on photos for insert with check (
  is_group_member(event_group(event_id)) and uploader_id = auth.uid()
);
create policy photos_update on photos for update using (uploader_id = auth.uid());
create policy photos_delete on photos for delete using (uploader_id = auth.uid());

-- expenses: 멤버 조회·생성, 수정·삭제는 작성자 또는 결제자
create policy expenses_select on expenses for select using (is_group_member(event_group(event_id)));
create policy expenses_insert on expenses for insert with check (
  is_group_member(event_group(event_id)) and created_by = auth.uid()
);
create policy expenses_update on expenses for update
  using (created_by = auth.uid() or payer_id = auth.uid());
create policy expenses_delete on expenses for delete
  using (created_by = auth.uid() or payer_id = auth.uid());

-- expense_participants: 멤버 조회, 지출 작성자·결제자가 관리
create policy expense_participants_select on expense_participants for select using (
  exists (select 1 from expenses e
          where e.id = expense_id and is_group_member(event_group(e.event_id)))
);
create policy expense_participants_write on expense_participants for all using (
  exists (select 1 from expenses e
          where e.id = expense_id and (e.created_by = auth.uid() or e.payer_id = auth.uid()))
);

-- settlements/transfers: 멤버 조회. 생성·전환은 RPC(SECURITY DEFINER)만.
create policy settlements_select on settlements for select
  using (is_group_member(event_group(event_id)));
-- transfers 상태 갱신: 보낸 사람이 sent, 받는 사람이 confirmed (검증은 트리거)
create policy settlement_transfers_select on settlement_transfers for select using (
  exists (select 1 from settlements s
          where s.id = settlement_id and is_group_member(event_group(s.event_id)))
);
create policy settlement_transfers_update on settlement_transfers for update
  using (from_user = auth.uid() or to_user = auth.uid());

-- ── 확정 잠금: closed 정산이 있는 이벤트의 지출 변경 차단 ──
create function block_expense_when_closed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  eid uuid;
begin
  eid := coalesce(new.event_id, old.event_id);
  if exists (select 1 from settlements where event_id = eid and status = 'closed') then
    raise exception '정산이 확정된 이벤트입니다. 지출을 수정하려면 정산을 취소하세요.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger expenses_lock
  before insert or update or delete on expenses
  for each row execute function block_expense_when_closed();

create function block_expense_participants_when_closed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  eid uuid;
begin
  select event_id into eid from expenses where id = coalesce(new.expense_id, old.expense_id);
  if exists (select 1 from settlements where event_id = eid and status = 'closed') then
    raise exception '정산이 확정된 이벤트입니다. 지출을 수정하려면 정산을 취소하세요.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger expense_participants_lock
  before insert or update or delete on expense_participants
  for each row execute function block_expense_participants_when_closed();

-- ── 이체 상태 전이 검증: pending→sent는 보낸 사람, sent/pending→confirmed는 받는 사람 ──
create function validate_transfer_update()
returns trigger
language plpgsql
as $$
begin
  if new.from_user <> old.from_user or new.to_user <> old.to_user
     or new.amount <> old.amount or new.settlement_id <> old.settlement_id then
    raise exception '이체 내역은 수정할 수 없습니다. 상태만 변경 가능합니다.';
  end if;
  if new.status = 'sent' and old.status = 'pending' then
    if auth.uid() <> old.from_user then
      raise exception '송금 표시는 보내는 사람만 할 수 있습니다.';
    end if;
    new.sent_at := now();
  elsif new.status = 'confirmed' and old.status in ('pending', 'sent') then
    if auth.uid() <> old.to_user then
      raise exception '수령 확인은 받는 사람만 할 수 있습니다.';
    end if;
    new.confirmed_at := now();
  elsif new.status <> old.status then
    raise exception '허용되지 않는 상태 변경입니다 (% → %)', old.status, new.status;
  end if;
  return new;
end;
$$;

create trigger settlement_transfers_validate
  before update on settlement_transfers
  for each row execute function validate_transfer_update();
