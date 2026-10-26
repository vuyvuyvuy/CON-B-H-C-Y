-- =====================================================================
-- CON BỆNH CẤP CỨU — schema Supabase / PostgreSQL
-- Nguyên tắc:
--   * Mọi bảng có user_id + RLS "chỉ chủ sở hữu".
--   * Nội dung thẻ (cards) tách khỏi trạng thái SRS (card_srs) để sync nhẹ.
--   * review_logs là nguồn sự thật, idempotent theo client_op_id
--     => offline trên iPad, online lại không bị ghi trùng.
--   * Realtime publication cho các bảng cần live trên mọi thiết bị.
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "vector";      -- pgvector cho embedding thẻ

-- ---------- ENUMS ----------
create type srs_state      as enum ('new', 'learning', 'review', 'relearning', 'suspended');
create type srs_rating     as enum ('again', 'hard', 'good', 'easy');
create type deck_source    as enum ('apkg', 'pdf', 'manual');
create type job_status     as enum ('queued', 'parsing', 'embedding', 'clustering', 'generating', 'validating', 'done', 'failed');
create type case_status    as enum ('draft', 'published', 'archived');
create type run_status     as enum ('in_progress', 'discharged', 'dead');
create type device_kind    as enum ('phone', 'tablet', 'desktop', 'unknown');

-- ---------- helper: updated_at ----------
create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- =====================================================================
-- 1. NGƯỜI DÙNG & THIẾT BỊ
-- =====================================================================
create table profiles (
  id                uuid primary key references auth.users on delete cascade,
  display_name      text,
  timezone          text not null default 'Asia/Ho_Chi_Minh',
  streak_current    int  not null default 0,
  streak_best       int  not null default 0,
  last_study_date   date,
  total_answers     int  not null default 0,
  wrong_answers     int  not null default 0,
  patients_killed   int  not null default 0,
  patients_saved    int  not null default 0,
  rank_code         text not null default 'mam_non',
  nag_level         smallint not null default 2 check (nag_level between 0 and 3), -- 0 = hiền, 3 = cục súc max
  quiet_hours       int4range default '[0,7)',                                    -- không spam lúc 0h–7h
  updated_at        timestamptz not null default now()
);

create table devices (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users on delete cascade,
  kind              device_kind not null default 'unknown',
  label             text,                                  -- "iPad của tui"
  push_subscription jsonb,                                 -- Web Push subscription (endpoint, keys)
  last_seen_at      timestamptz not null default now(),
  last_pulled_event bigint not null default 0,             -- con trỏ sync_events đã kéo về
  created_at        timestamptz not null default now()
);
create index on devices (user_id);

-- =====================================================================
-- 2. HỌC PHẦN & LỊCH THI (từ file DMHP + LỊCH THI YVD)
-- =====================================================================
create table subjects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  code        text not null,           -- THH0049, DL0050, MAT0051...
  name        text not null,           -- "Tâm thần"
  short_name  text,                    -- "TÂM THẦN"
  semester    smallint,                -- 1 | 2
  credits     smallint,
  department  text,                    -- "Khoa Y", "Giảng viên Đức"
  unique (user_id, code)
);

create table exams (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users on delete cascade,
  subject_id      uuid references subjects on delete set null,
  title           text not null,               -- "Tai Mũi Họng", "LS Tâm Thần"
  exam_at         timestamptz not null,        -- lưu UTC, hiển thị theo profiles.timezone
  total_slides    int,
  total_questions int,
  slides_done     int not null default 0,
  is_done         boolean not null default false,
  updated_at      timestamptz not null default now()
);
create index on exams (user_id, exam_at);
create trigger exams_touch before update on exams for each row execute function touch_updated_at();

-- =====================================================================
-- 3. DECK & CARD
-- =====================================================================
create table decks (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users on delete cascade,
  subject_id     uuid references subjects on delete set null,
  name           text not null,
  source         deck_source not null,
  source_path    text,                         -- đường dẫn trong Supabase Storage
  anki_deck_id   bigint,                       -- id deck gốc trong collection.anki2
  card_count     int not null default 0,
  created_at     timestamptz not null default now()
);

create table cards (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users on delete cascade,
  deck_id        uuid not null references decks on delete cascade,
  anki_note_id   bigint,
  anki_card_id   bigint,
  front          text not null,                -- đã strip HTML
  back           text not null,
  extra          text,
  tags           text[] not null default '{}',
  content_hash   text not null,                -- sha1(front||back) — re-import không nhân bản
  embedding      vector(1536),                 -- text-embedding-3-small
  created_at     timestamptz not null default now(),
  unique (deck_id, content_hash)
);
create index on cards (user_id, deck_id);
create index on cards using hnsw (embedding vector_cosine_ops);

-- Trạng thái SRS — 1 dòng / thẻ / user. Bảng "nóng" nhất cho sync.
create table card_srs (
  card_id          uuid primary key references cards on delete cascade,
  user_id          uuid not null references auth.users on delete cascade,
  state            srs_state not null default 'new',
  due_at           timestamptz not null default now(),
  interval_days    real not null default 0,
  ease             real not null default 2.5,
  reps             int  not null default 0,
  lapses           int  not null default 0,
  learning_step    smallint not null default 0,
  last_reviewed_at timestamptz,
  last_op_id       uuid,                        -- op cuối cùng đã áp dụng (debug sync)
  updated_at       timestamptz not null default now()
);
create index card_srs_due on card_srs (user_id, due_at) where state <> 'suspended';
create trigger card_srs_touch before update on card_srs for each row execute function touch_updated_at();

-- =====================================================================
-- 4. CA LÂM SÀNG (AI GEN) & LƯỢT CHƠI
-- =====================================================================
create table import_jobs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  deck_id      uuid references decks on delete cascade,
  status       job_status not null default 'queued',
  progress     real not null default 0,          -- 0..1, client subscribe realtime để vẽ thanh tiến trình
  stats        jsonb not null default '{}',      -- {cards: 152, clusters: 12, cases: 11, orphan_cards: 7}
  error        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger import_jobs_touch before update on import_jobs for each row execute function touch_updated_at();

create table clinical_cases (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users on delete cascade,
  deck_id          uuid not null references decks on delete cascade,
  job_id           uuid references import_jobs on delete set null,
  title            text not null,               -- "Cơn hen ác tính lúc 2h sáng"
  topic            text not null,               -- chủ đề bệnh lý của cụm thẻ
  patient          jsonb not null,              -- {name, age, sex, vitals:{hr,bp,spo2,rr,temp}, history}
  opening          text not null,               -- đoạn mở đầu roleplay
  max_hp           int not null default 100,
  difficulty       smallint not null default 2 check (difficulty between 1 and 3),
  status           case_status not null default 'published',
  model            text not null,
  prompt_version   text not null,
  created_at       timestamptz not null default now()
);

create table case_steps (
  id             uuid primary key default gen_random_uuid(),
  case_id        uuid not null references clinical_cases on delete cascade,
  step_order     smallint not null,
  narrative      text not null,                 -- diễn biến: "SpO2 tụt 84%, bệnh nhân vật vã..."
  question       text not null,                 -- "Bạn làm gì tiếp theo?"
  options        jsonb not null,                -- [{id:'a', text, is_correct, rationale}]
  hp_penalty     smallint not null default 25,
  card_ids       uuid[] not null,               -- thẻ Anki mà bước này kiểm tra
  unique (case_id, step_order)
);

-- Bảng nối để query ngược "thẻ X nằm trong ca nào"
create table case_cards (
  case_id  uuid references clinical_cases on delete cascade,
  card_id  uuid references cards on delete cascade,
  primary key (case_id, card_id)
);

create table case_runs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  case_id       uuid not null references clinical_cases on delete cascade,
  hp            int not null,
  current_step  smallint not null default 0,
  status        run_status not null default 'in_progress',
  device_id     uuid references devices on delete set null,   -- bắt đầu trên iPad, chơi tiếp trên PC
  started_at    timestamptz not null default now(),
  ended_at      timestamptz,
  updated_at    timestamptz not null default now()
);
create index on case_runs (user_id, status);
create trigger case_runs_touch before update on case_runs for each row execute function touch_updated_at();

-- =====================================================================
-- 5. NGHĨA TRANG & THẮP NHANG
-- =====================================================================
create table tombstones (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users on delete cascade,
  run_id          uuid not null unique references case_runs on delete cascade,
  case_id         uuid not null references clinical_cases on delete cascade,
  epitaph         text not null,                 -- "Đã ra đi vì bác sĩ quên chống chỉ định của Morphin"
  cause_card_ids  uuid[] not null,               -- các thẻ trả lời sai => phải ôn để chuộc lỗi
  incense_needed  int not null,                  -- = số thẻ sai
  incense_lit     int not null default 0,
  died_at         timestamptz not null default now(),
  redeemed_at     timestamptz                    -- null = hồn còn oán
);
create index on tombstones (user_id, redeemed_at);

create table incense_offerings (
  id            bigserial primary key,
  tombstone_id  uuid not null references tombstones on delete cascade,
  user_id       uuid not null references auth.users on delete cascade,
  card_id       uuid not null references cards on delete cascade,
  rating        srs_rating not null,
  lit_at        timestamptz not null default now(),
  unique (tombstone_id, card_id)                 -- mỗi thẻ thắp 1 nén là đủ (nếu trả lời >= good)
);

-- =====================================================================
-- 6. LOG ÔN TẬP & ĐỒNG BỘ ĐA THIẾT BỊ
-- =====================================================================
create table review_logs (
  id              bigserial primary key,
  client_op_id    uuid not null,                -- sinh trên client => retry an toàn
  user_id         uuid not null references auth.users on delete cascade,
  card_id         uuid not null references cards on delete cascade,
  run_id          uuid references case_runs on delete set null,
  step_id         uuid references case_steps on delete set null,
  device_id       uuid references devices on delete set null,
  rating          srs_rating not null,
  was_correct     boolean not null,
  hp_delta        int not null default 0,
  elapsed_ms      int,
  prev_interval   real,
  new_interval    real,
  prev_due        timestamptz,
  new_due         timestamptz,
  reviewed_at     timestamptz not null,         -- thời điểm trên client (có thể offline)
  received_at     timestamptz not null default now(),
  unique (client_op_id, card_id)                -- 1 câu trả lời chạm nhiều thẻ, cùng 1 op id
);
create index on review_logs (user_id, reviewed_at desc);

-- Change feed tổng quát: thiết bị offline kéo các thay đổi id > last_pulled_event
create table sync_events (
  id            bigserial primary key,
  user_id       uuid not null references auth.users on delete cascade,
  entity        text not null,                  -- 'card_srs' | 'case_runs' | 'exams' | 'profiles' | 'tombstones'
  entity_id     text not null,
  op            text not null check (op in ('insert', 'update', 'delete')),
  payload       jsonb,
  device_id     uuid,
  created_at    timestamptz not null default now()
);
create index on sync_events (user_id, id);

create or replace function log_sync_event() returns trigger
language plpgsql security definer as $$
declare
  rec jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into sync_events (user_id, entity, entity_id, op, payload)
  values (
    (rec->>'user_id')::uuid,
    tg_table_name,
    coalesce(rec->>'id', rec->>'card_id'),
    lower(tg_op),
    case when tg_op = 'DELETE' then null else rec end
  );
  return null;
end $$;

create trigger card_srs_sync   after insert or update or delete on card_srs   for each row execute function log_sync_event();
create trigger case_runs_sync  after insert or update or delete on case_runs  for each row execute function log_sync_event();
create trigger exams_sync      after insert or update or delete on exams      for each row execute function log_sync_event();
create trigger tombstones_sync after insert or update or delete on tombstones for each row execute function log_sync_event();

create table notification_log (
  id          bigserial primary key,
  user_id     uuid not null references auth.users on delete cascade,
  device_id   uuid references devices on delete set null,
  template    text not null,
  body        text not null,
  sent_at     timestamptz not null default now()
);
create index on notification_log (user_id, sent_at desc);

-- =====================================================================
-- 7. RPC: chấm 1 câu trả lời trong ca — atomic, idempotent
-- SRS mới được tính ở server Next.js (lib/srs.ts) rồi truyền vào p_srs:
--   [{card_id, rating, state, due_at, interval_days, ease, reps, lapses, learning_step}]
-- =====================================================================
create or replace function submit_case_answer(
  p_op_id      uuid,
  p_run_id     uuid,
  p_step_id    uuid,
  p_option_id  text,
  p_device_id  uuid,
  p_elapsed_ms int,
  p_reviewed_at timestamptz,
  p_srs        jsonb
) returns jsonb
language plpgsql security invoker as $$
declare
  v_run      case_runs;
  v_step     case_steps;
  v_correct  boolean;
  v_delta    int;
  v_status   run_status;
  v_total    int;
  v_s        jsonb;
begin
  -- Idempotent: op này đã chạy => trả kết quả cũ
  if exists (select 1 from review_logs where client_op_id = p_op_id) then
    select to_jsonb(r) into v_s from case_runs r where id = p_run_id;
    return jsonb_build_object('duplicate', true, 'run', v_s);
  end if;

  select * into v_run from case_runs where id = p_run_id and user_id = auth.uid() for update;
  if not found or v_run.status <> 'in_progress' then
    raise exception 'RUN_NOT_ACTIVE';
  end if;

  select * into v_step from case_steps where id = p_step_id and case_id = v_run.case_id;
  if v_step.step_order <> v_run.current_step then
    raise exception 'STEP_OUT_OF_ORDER';   -- 2 thiết bị bấm cùng lúc: thằng đến sau bị từ chối
  end if;

  select coalesce((o->>'is_correct')::boolean, false) into v_correct
  from jsonb_array_elements(v_step.options) o where o->>'id' = p_option_id;
  v_correct := coalesce(v_correct, false);

  v_delta  := case when v_correct then 0 else -v_step.hp_penalty end;
  select count(*) into v_total from case_steps where case_id = v_run.case_id;

  v_status := case
    when v_run.hp + v_delta <= 0              then 'dead'
    when v_run.current_step + 1 >= v_total    then 'discharged'
    else 'in_progress' end;

  update case_runs set
    hp           = greatest(0, hp + v_delta),
    current_step = current_step + 1,
    status       = v_status,
    ended_at     = case when v_status <> 'in_progress' then now() end
  where id = p_run_id
  returning * into v_run;

  -- Ghi log + cập nhật SRS cho từng thẻ của bước này
  for v_s in select * from jsonb_array_elements(p_srs) loop
    insert into review_logs (client_op_id, user_id, card_id, run_id, step_id, device_id, rating, was_correct,
                             hp_delta, elapsed_ms, prev_interval, new_interval, prev_due, new_due, reviewed_at)
    select p_op_id, auth.uid(), (v_s->>'card_id')::uuid, p_run_id, p_step_id, p_device_id,
           (v_s->>'rating')::srs_rating, v_correct, v_delta, p_elapsed_ms,
           cs.interval_days, (v_s->>'interval_days')::real, cs.due_at, (v_s->>'due_at')::timestamptz, p_reviewed_at
    from (select 1) x
    left join card_srs cs on cs.card_id = (v_s->>'card_id')::uuid;

    insert into card_srs (card_id, user_id, state, due_at, interval_days, ease, reps, lapses, learning_step, last_reviewed_at, last_op_id)
    values ((v_s->>'card_id')::uuid, auth.uid(), (v_s->>'state')::srs_state, (v_s->>'due_at')::timestamptz,
            (v_s->>'interval_days')::real, (v_s->>'ease')::real, (v_s->>'reps')::int, (v_s->>'lapses')::int,
            (v_s->>'learning_step')::smallint, p_reviewed_at, p_op_id)
    on conflict (card_id) do update set
      state = excluded.state, due_at = excluded.due_at, interval_days = excluded.interval_days,
      ease = excluded.ease, reps = excluded.reps, lapses = excluded.lapses,
      learning_step = excluded.learning_step, last_reviewed_at = excluded.last_reviewed_at,
      last_op_id = excluded.last_op_id
    -- Last-write-wins theo thời điểm ôn THỰC TẾ, không theo thời điểm server nhận
    where card_srs.last_reviewed_at is null or card_srs.last_reviewed_at <= excluded.last_reviewed_at;
  end loop;

  update profiles set
    total_answers   = total_answers + 1,
    wrong_answers   = wrong_answers + (not v_correct)::int,
    patients_killed = patients_killed + (v_status = 'dead')::int,
    patients_saved  = patients_saved  + (v_status = 'discharged')::int
  where id = auth.uid();

  -- Bệnh nhân "đăng xuất" => dựng bia mộ, gom các thẻ đã trả lời sai trong run
  if v_status = 'dead' then
    insert into tombstones (user_id, run_id, case_id, epitaph, cause_card_ids, incense_needed)
    select auth.uid(), p_run_id, v_run.case_id,
           'Ra đi lúc ' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM') || '. Hung thủ: chính bạn.',
           array_agg(distinct card_id), count(distinct card_id)
    from review_logs where run_id = p_run_id and not was_correct;
  end if;

  return jsonb_build_object(
    'duplicate', false,
    'correct',   v_correct,
    'hp_delta',  v_delta,
    'run',       to_jsonb(v_run)
  );
end $$;

-- =====================================================================
-- 8. RLS
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'devices','subjects','exams','decks','cards','card_srs','import_jobs','clinical_cases',
    'case_runs','tombstones','incense_offerings','review_logs','sync_events','notification_log'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy owner_all on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

alter table profiles enable row level security;
create policy self on profiles for all using (id = auth.uid()) with check (id = auth.uid());

alter table case_steps enable row level security;
create policy via_case on case_steps for select
  using (exists (select 1 from clinical_cases c where c.id = case_id and c.user_id = auth.uid()));
alter table case_cards enable row level security;
create policy via_case on case_cards for select
  using (exists (select 1 from clinical_cases c where c.id = case_id and c.user_id = auth.uid()));

-- =====================================================================
-- 9. REALTIME — các bảng thay đổi phải hiện ngay trên mọi thiết bị
-- =====================================================================
alter publication supabase_realtime add table card_srs, case_runs, exams, profiles, tombstones, import_jobs;

-- Tạo profile khi đăng ký
create or replace function handle_new_user() returns trigger
language plpgsql security definer as $$
begin
  insert into profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'name', 'Lang băm vô danh'));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();
