-- 0007_hardening.sql — 비용·남용 방어
-- ① photos 버킷: 파일 2MB 제한 + WebP만 허용 (클라이언트 리사이즈를 우회한 대용량 업로드 차단)
-- ② OCR 사용량 기록: Edge Function이 service role로 일일 호출 수를 세어 제한

update storage.buckets
set file_size_limit = 2097152, -- 2MB (리사이즈 결과는 ~300KB)
    allowed_mime_types = array['image/webp']
where id = 'photos';

create table ocr_usage (
  user_id uuid not null,
  day date not null,
  count integer not null default 1,
  primary key (user_id, day)
);

-- 클라이언트 접근 차단 (Edge Function의 service role만 사용)
alter table ocr_usage enable row level security;

-- 원자적 증가 (service role 전용 — 일반 사용자는 RLS로 차단됨)
create function increment_ocr_usage(p_user_id uuid, p_day date)
returns integer
language sql
security definer
set search_path = public
as $$
  update ocr_usage
  set count = count + 1
  where user_id = p_user_id and day = p_day
  returning count;
$$;

revoke execute on function increment_ocr_usage(uuid, date) from anon, authenticated;
