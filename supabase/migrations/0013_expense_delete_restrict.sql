-- 0013_expense_delete_restrict.sql — 절충안: 수정은 그룹 멤버 전체, 삭제는 작성자·결제자만
-- (수정은 복구 가능하지만 삭제는 되돌릴 수 없으므로)

drop policy expenses_delete on expenses;
create policy expenses_delete on expenses for delete
  using (created_by = auth.uid() or payer_id = auth.uid());
