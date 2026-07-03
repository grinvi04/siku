-- 0017_storage_delete_no_orphan.sql
-- LOW 수정(품질 리메디에이션 §1): storage 파일 삭제(0014, 그룹 멤버 전체)와
-- photos 행 삭제(0002, 업로더만)의 권한 주체가 달라, 멤버가 타인의 파일만 직접
-- 삭제하면 photos 행이 남아 깨진 참조(orphan row)가 생길 수 있었다.
--
-- 0014의 의도(기록 전체 삭제 시 타인 파일까지 일괄 정리)는 유지하면서, 아직
-- 참조하는 photos 행이 살아있는 파일은 업로더만 지울 수 있도록 좁힌다.
--   · 앱의 두 삭제 흐름(개별 deletePhotos · 이벤트 deleteEvent)은 모두 행을 먼저
--     지운 뒤 파일을 제거하므로 → 제거 시점에 참조 행이 없어 그대로 허용된다.
--   · 행이 남아있는 파일을 비-업로더가 직접(out-of-band) 지우는 경로만 차단 → orphan row 방지.
-- (photos_select가 같은 그룹 멤버에게 전 행을 노출하므로 아래 서브쿼리는 멤버 컨텍스트에서 올바르게 보인다.)
-- forward-only: 0014를 수정하지 않고 정책을 교체한다.

drop policy photos_storage_delete on storage.objects;

create policy photos_storage_delete on storage.objects for delete using (
  bucket_id = 'photos'
  and is_group_member(((storage.foldername(name))[1])::uuid)
  and (
    owner = auth.uid()
    or not exists (
      select 1 from photos
      where photos.storage_path = storage.objects.name
         or photos.thumb_path = storage.objects.name
    )
  )
);
