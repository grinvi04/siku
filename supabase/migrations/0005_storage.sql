-- 0005_storage.sql — 사진 버킷(비공개) + 경로 기반 RLS
-- 경로 규칙: {group_id}/{event_id}/{photo_id}.webp — 첫 세그먼트로 멤버십 검사

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false);

create policy photos_storage_select on storage.objects for select using (
  bucket_id = 'photos'
  and is_group_member(((storage.foldername(name))[1])::uuid)
);

create policy photos_storage_insert on storage.objects for insert with check (
  bucket_id = 'photos'
  and is_group_member(((storage.foldername(name))[1])::uuid)
);

-- 삭제는 업로더 본인만 (owner는 업로드한 사용자의 auth.uid)
create policy photos_storage_delete on storage.objects for delete using (
  bucket_id = 'photos'
  and owner = auth.uid()
);
