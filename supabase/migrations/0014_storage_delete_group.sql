-- 0014_storage_delete_group.sql — 기록 삭제 시 타인 사진 파일이 고아로 남던 빈틈 수정
-- 파일 삭제를 그룹 멤버로 완화. 개별 사진 삭제 권한은 photos 행 정책(업로더만)이 계속 강제하므로
-- 앱 흐름은 변화 없음 — 기록 전체 삭제의 파일 정리만 가능해진다.

drop policy photos_storage_delete on storage.objects;
create policy photos_storage_delete on storage.objects for delete using (
  bucket_id = 'photos'
  and is_group_member(((storage.foldername(name))[1])::uuid)
);
