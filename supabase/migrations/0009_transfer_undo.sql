-- 0009_transfer_undo.sql — 송금 상태 실수 클릭 되돌리기 허용
-- 보낸 사람: 보냄 취소(sent→pending) / 받는 사람: 수령 확인 취소(confirmed→sent|pending)

create or replace function validate_transfer_update()
returns trigger
language plpgsql
as $$
begin
  if new.from_user <> old.from_user or new.to_user <> old.to_user
     or new.amount <> old.amount or new.settlement_id <> old.settlement_id then
    raise exception '이체 내역은 수정할 수 없습니다. 상태만 변경 가능합니다.';
  end if;

  if new.status = old.status then
    return new;
  elsif old.status = 'pending' and new.status = 'sent' then
    if auth.uid() <> old.from_user then
      raise exception '송금 표시는 보내는 사람만 할 수 있습니다.';
    end if;
    new.sent_at := now();
  elsif old.status = 'sent' and new.status = 'pending' then
    if auth.uid() <> old.from_user then
      raise exception '송금 표시 취소는 보내는 사람만 할 수 있습니다.';
    end if;
    new.sent_at := null;
  elsif old.status in ('pending', 'sent') and new.status = 'confirmed' then
    if auth.uid() <> old.to_user then
      raise exception '수령 확인은 받는 사람만 할 수 있습니다.';
    end if;
    new.confirmed_at := now();
  elsif old.status = 'confirmed' and new.status in ('sent', 'pending') then
    if auth.uid() <> old.to_user then
      raise exception '수령 확인 취소는 받는 사람만 할 수 있습니다.';
    end if;
    new.confirmed_at := null;
    if new.status = 'pending' then
      new.sent_at := null;
    end if;
  else
    raise exception '허용되지 않는 상태 변경입니다 (% → %)', old.status, new.status;
  end if;
  return new;
end;
$$;
