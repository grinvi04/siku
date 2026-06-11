-- 0012_expenses_member_edit.sql — 지출 수정·삭제를 그룹 멤버 전체에 허용
-- 총무가 남이 결제한 건을 대신 입력·수정하는 것이 모임의 일반적인 흐름.
-- (확정 잠금 트리거가 정산 후 변경을 막고, 신뢰 기반 소그룹 원칙은 visits와 동일)

drop policy expenses_update on expenses;
drop policy expenses_delete on expenses;
create policy expenses_update on expenses for update
  using (is_group_member(event_group(event_id)));
create policy expenses_delete on expenses for delete
  using (is_group_member(event_group(event_id)));

drop policy expense_participants_write on expense_participants;
create policy expense_participants_write on expense_participants for all using (
  exists (select 1 from expenses e
          where e.id = expense_id and is_group_member(event_group(e.event_id)))
);
