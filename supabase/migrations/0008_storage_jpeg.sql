-- 0008_storage_jpeg.sql — Safari는 WebP 인코딩이 안 되어 JPEG로 폴백하므로 허용 형식에 추가

update storage.buckets
set allowed_mime_types = array['image/webp', 'image/jpeg']
where id = 'photos';
