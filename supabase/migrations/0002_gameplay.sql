-- =====================================================================
-- 0002 — gameplay: streak, khởi tạo SRS, chọn ca, mở lượt, thắp nhang,
--        nạp sẵn lịch thi YVD 26–27, bucket Storage.
-- =====================================================================

-- ---------- Thẻ mới => có ngay dòng card_srs (để đếm thẻ đến hạn) ----------
create or replace function init_card_srs() returns trigger
language plpgsql security definer as $$
begin
  insert into card_srs (card_id, user_id) values (new.id, new.user_id) on conflict do nothing;
  return null;
end $$;
create trigger cards_init_srs after insert on cards for each row execute function init_card_srs();

-- ---------- Streak: gọi mỗi khi user học (trả lời ca / thắp nhang) ----------
create or replace function bump_streak(p_user uuid, p_at timestamptz) returns void
language plpgsql security definer as $$
declare
  v_tz    text;
  v_day   date;
begin
  select timezone into v_tz from profiles where id = p_user;
  v_day := (p_at at time zone coalesce(v_tz, 'Asia/Ho_Chi_Minh'))::date;
  update profiles set
    streak_current = case
      when last_study_date = v_day     then streak_current          -- đã học hôm nay
      when last_study_date = v_day - 1 then streak_current + 1      -- nối chuỗi
      when last_study_date > v_day     then streak_current          -- log offline cũ tới muộn
      else 1 end,
    last_study_date = greatest(coalesce(last_study_date, v_day), v_day)
  where id = p_user;
  update profiles set streak_best = greatest(streak_best, streak_current) where id = p_user;
end $$;

-- submit_case_answer (0001) + bump_streak
create or replace function submit_case_answer_v2(
  p_op_id uuid, p_run_id uuid, p_step_id uuid, p_option_id text, p_device_id uuid,
  p_elapsed_ms int, p_reviewed_at timestamptz, p_srs jsonb
) returns jsonb
language plpgsql security invoker as $$
declare v jsonb;
begin
  v := submit_case_answer(p_op_id, p_run_id, p_step_id, p_option_id, p_device_id, p_elapsed_ms, p_reviewed_at, p_srs);
  if not (v->>'duplicate')::boolean then
    perform bump_streak(auth.uid(), p_reviewed_at);
  end if;
  return v;
end $$;

-- ---------- Chọn ca: ưu tiên ca chứa nhiều thẻ đến hạn nhất, môn sắp thi nhất ----------
create or replace function case_queue(p_limit int default 20)
returns table (
  case_id uuid, title text, topic text, difficulty smallint, deck_name text,
  due_cards bigint, total_cards bigint, next_exam_at timestamptz, active_run uuid, deaths bigint
)
language sql stable security invoker as $$
  select c.id, c.title, c.topic, c.difficulty, d.name,
         count(*) filter (where s.due_at <= now() and s.state <> 'suspended'),
         count(*),
         (select min(e.exam_at) from exams e where e.subject_id = d.subject_id and not e.is_done and e.exam_at > now()),
         (select r.id from case_runs r where r.case_id = c.id and r.status = 'in_progress' order by r.updated_at desc limit 1),
         (select count(*) from case_runs r where r.case_id = c.id and r.status = 'dead')
  from clinical_cases c
  join decks d on d.id = c.deck_id
  join case_cards cc on cc.case_id = c.id
  left join card_srs s on s.card_id = cc.card_id
  where c.user_id = auth.uid() and c.status = 'published'
  group by c.id, d.name, d.subject_id
  order by 9 nulls last,                -- ca đang dở lên đầu
           6 desc, 8 nulls last, c.created_at
  limit p_limit
$$;

-- ---------- Mở lượt chơi (hoặc trả lượt đang dở — chơi tiếp trên máy khác) ----------
create or replace function start_run(p_case_id uuid, p_device_id uuid default null) returns case_runs
language plpgsql security invoker as $$
declare v case_runs;
begin
  select * into v from case_runs
  where case_id = p_case_id and user_id = auth.uid() and status = 'in_progress'
  order by updated_at desc limit 1;
  if found then return v; end if;

  insert into case_runs (user_id, case_id, hp, device_id)
  select auth.uid(), c.id, c.max_hp, p_device_id from clinical_cases c
  where c.id = p_case_id and c.user_id = auth.uid()
  returning * into v;
  if v.id is null then raise exception 'CASE_NOT_FOUND'; end if;
  return v;
end $$;

-- ---------- Thắp nhang: ôn lại 1 thẻ gây chết ----------
-- SRS đã tính ở server (lib/srs.ts), truyền vào p_srs. Chỉ rating >= good mới tính là 1 nén.
create or replace function light_incense(
  p_tombstone_id uuid, p_card_id uuid, p_rating srs_rating, p_op_id uuid,
  p_reviewed_at timestamptz, p_srs jsonb, p_device_id uuid default null
) returns tombstones
language plpgsql security invoker as $$
declare v tombstones;
begin
  select * into v from tombstones where id = p_tombstone_id and user_id = auth.uid() for update;
  if not found then raise exception 'TOMBSTONE_NOT_FOUND'; end if;
  if not (p_card_id = any (v.cause_card_ids)) then raise exception 'CARD_NOT_IN_GRAVE'; end if;
  if exists (select 1 from review_logs where client_op_id = p_op_id) then return v; end if;

  insert into review_logs (client_op_id, user_id, card_id, device_id, rating, was_correct, prev_interval, new_interval, prev_due, new_due, reviewed_at)
  select p_op_id, auth.uid(), p_card_id, p_device_id, p_rating, p_rating in ('good','easy'),
         s.interval_days, (p_srs->>'interval_days')::real, s.due_at, (p_srs->>'due_at')::timestamptz, p_reviewed_at
  from card_srs s where s.card_id = p_card_id;

  update card_srs set
    state = (p_srs->>'state')::srs_state, due_at = (p_srs->>'due_at')::timestamptz,
    interval_days = (p_srs->>'interval_days')::real, ease = (p_srs->>'ease')::real,
    reps = (p_srs->>'reps')::int, lapses = (p_srs->>'lapses')::int,
    learning_step = (p_srs->>'learning_step')::smallint, last_reviewed_at = p_reviewed_at, last_op_id = p_op_id
  where card_id = p_card_id and (last_reviewed_at is null or last_reviewed_at <= p_reviewed_at);

  if p_rating in ('good', 'easy') then
    insert into incense_offerings (tombstone_id, user_id, card_id, rating)
    values (p_tombstone_id, auth.uid(), p_card_id, p_rating) on conflict do nothing;
    update tombstones t set
      incense_lit = (select count(*) from incense_offerings i where i.tombstone_id = t.id),
      redeemed_at = case when (select count(*) from incense_offerings i where i.tombstone_id = t.id) >= t.incense_needed
                         then coalesce(t.redeemed_at, now()) end
    where t.id = p_tombstone_id
    returning * into v;
  end if;

  perform bump_streak(auth.uid(), p_reviewed_at);
  return v;
end $$;

-- ---------- Lịch thi & học phần YVD 26–27 (DMHP + LỊCH THI YVD) ----------
create or replace function seed_yvd_schedule(p_user uuid) returns void
language plpgsql security definer as $$
begin
  insert into subjects (user_id, code, name, short_name, semester, credits, department) values
    (p_user, 'THH0049',  'Tâm thần',                         'TÂM THẦN',          1, 4, 'Khoa Y'),
    (p_user, 'DL0050',   'Da liễu',                          'DA LIỄU',           1, 3, 'Khoa Y'),
    (p_user, 'MAT0051',  'Mắt',                              'MẮT',               1, 3, 'Khoa Y'),
    (p_user, 'TMH0054',  'Tai mũi họng',                     'TMH',               1, 3, 'Khoa Y'),
    (p_user, 'TK0055',   'Thần kinh',                        'THẦN KINH',         1, 4, 'Khoa Y'),
    (p_user, 'GMHS0058', 'Gây mê Hồi sức',                   'GMHS',              1, 5, 'Khoa Y'),
    (p_user, 'NHI0053',  'Nhi khoa',                         'NHI',               1, 5, 'Khoa Y'),
    (p_user, 'SPK0052',  'Sản Phụ Khoa',                     'SẢN-PHỤ',           1, 5, 'Khoa Y'),
    (p_user, 'DDYH0075', 'History, theory, ethics of medicine','HTE of medicine', 1, 2, 'Giảng viên Đức'),
    (p_user, 'NTQ005801','Ngoại Tổng quát I / II',           'Ngoại TQ',          2, 9, 'Khoa Y'),
    (p_user, 'NOI230059','Điều trị Nội / Nội III',           'Điều trị Nội',      2, 7, 'Khoa Y'),
    (p_user, 'YHGD0060', 'Y học Gia đình',                   'YHGĐ',              2, 2, 'Khoa Y'),
    (p_user, 'LAO0061',  'Lão khoa',                         'Lão khoa',          2, 2, 'Khoa Y'),
    (p_user, 'NHIEM0062','Nhiễm',                            'Nhiễm',             2, 2, 'Khoa Y'),
    (p_user, 'TTLP0063', 'Tâm thể Liệu pháp',                'Tâm thể LP',        2, 1, 'Khoa Y')
  on conflict (user_id, code) do nothing;

  insert into exams (user_id, subject_id, title, exam_at, total_slides, is_done)
  select p_user, s.id, x.title, x.exam_at::timestamptz, x.slides, x.done
  from (values
    ('THH0049',  'LS Tâm Thần',    '2026-10-09 07:00+07', null::int, true),
    ('TMH0054',  'Tai Mũi Họng',   '2026-11-06 13:30+07', 8,         false),
    ('THH0049',  'Tâm Thần',       '2026-11-13 09:30+07', 11,        false),
    ('DL0050',   'Da Liễu',        '2026-11-20 09:30+07', 15,        false),
    ('MAT0051',  'Mắt',            '2026-11-27 09:30+07', 11,        false),
    ('GMHS0058', 'Gây Mê Hồi Sức', '2026-12-11 13:30+07', null,      false),
    ('SPK0052',  'Sản Phụ Khoa',   '2026-12-18 13:30+07', null,      false),
    ('TK0055',   'Thần Kinh',      '2026-12-25 15:00+07', 8,         false),
    ('NHI0053',  'Nhi Khoa',       '2027-01-07 13:30+07', null,      false)
  ) as x(code, title, exam_at, slides, done)
  join subjects s on s.user_id = p_user and s.code = x.code
  where not exists (select 1 from exams e where e.user_id = p_user and e.title = x.title);
end $$;

create or replace function handle_new_user() returns trigger
language plpgsql security definer as $$
begin
  insert into profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'name', 'Lang băm vô danh'));
  perform seed_yvd_schedule(new.id);
  return new;
end $$;

-- ---------- Storage: bucket riêng tư, mỗi user một thư mục ----------
insert into storage.buckets (id, name, public) values ('imports', 'imports', false) on conflict do nothing;
create policy "imports_owner" on storage.objects for all
  using (bucket_id = 'imports' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'imports' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- case_steps / case_cards: cho phép ghi qua client của user (import route) ----------
create policy via_case_write on case_steps for insert
  with check (exists (select 1 from clinical_cases c where c.id = case_id and c.user_id = auth.uid()));
create policy via_case_write on case_cards for insert
  with check (exists (select 1 from clinical_cases c where c.id = case_id and c.user_id = auth.uid()));

-- ---------- Sinh hiệu theo từng bước (AI trả về; monitor nhảy số) ----------
alter table case_steps add column if not exists vitals jsonb;

-- ---------- Duyệt ca nháp: cho phép user sửa/xoá ca của mình (RLS owner_all đã cover) ----------
