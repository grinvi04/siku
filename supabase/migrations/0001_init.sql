-- 0001_init.sql — 테이블 정의
-- 금액은 모두 KRW 정수(원). 음수 지출 = 환불·환급.

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url text,
  bank_name text,
  account_number text,
  account_holder text,
  created_at timestamptz not null default now()
);

create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default encode(gen_random_bytes(9), 'base64'),
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

create table group_members (
  group_id uuid not null references groups (id) on delete cascade,
  user_id uuid not null references profiles (id),
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups (id) on delete cascade,
  title text not null,
  type text not null default 'dinner' check (type in ('dinner', 'ride', 'trip')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

create table event_participants (
  event_id uuid not null references events (id) on delete cascade,
  user_id uuid not null references profiles (id),
  primary key (event_id, user_id)
);

create table visits (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  name text,
  lat double precision not null,
  lng double precision not null,
  radius_m integer not null default 150,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  source text not null check (source in ('auto', 'manual')),
  status text not null default 'suggested'
    check (status in ('suggested', 'confirmed', 'rejected')),
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

create table photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  uploader_id uuid not null references profiles (id),
  storage_path text not null,
  thumb_path text not null,
  taken_at timestamptz,           -- EXIF 없으면 null (클러스터링 제외, 업로드 시각 정렬)
  lat double precision,
  lng double precision,
  visit_id uuid references visits (id) on delete set null,
  status text not null default 'confirmed' check (status in ('pending', 'confirmed')),
  size_bytes integer not null,
  width integer,
  height integer,
  created_at timestamptz not null default now()
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  payer_id uuid not null references profiles (id),  -- 참여자가 아닐 수 있음
  title text not null,
  amount integer not null check (amount <> 0),       -- 음수 = 환불·환급
  spent_at timestamptz not null default now(),
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

create table expense_participants (
  expense_id uuid not null references expenses (id) on delete cascade,
  user_id uuid not null references profiles (id),
  share_amount integer,                              -- null = 균등분할
  primary key (expense_id, user_id)
);

-- 정산 row는 확정(close_settlement RPC) 시점에만 생성된다.
-- closed = 현재 유효한 확정 (이벤트당 1개), reopened = 취소된 과거 확정 (이력 보존)
create table settlements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  status text not null default 'closed' check (status in ('closed', 'reopened')),
  created_at timestamptz not null default now(),
  reopened_at timestamptz
);

create unique index settlements_one_closed_per_event
  on settlements (event_id) where status = 'closed';

create table settlement_transfers (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references settlements (id) on delete cascade,
  from_user uuid not null references profiles (id),
  to_user uuid not null references profiles (id),
  amount integer not null check (amount > 0),
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'confirmed')),
  sent_at timestamptz,
  confirmed_at timestamptz
);

create index photos_event_taken_idx on photos (event_id, taken_at);
create index expenses_event_idx on expenses (event_id);
create index visits_event_idx on visits (event_id, order_index);
