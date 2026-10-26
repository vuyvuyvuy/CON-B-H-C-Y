-- Kịch bản: đăng ký -> có lịch thi -> import thẻ -> chơi ca -> chết -> thắp nhang -> siêu thoát.
\set ON_ERROR_STOP on
\o /dev/null
\set u '\'11111111-1111-1111-1111-111111111111\''
insert into auth.users (id, raw_user_meta_data) values (:u, '{"name":"Test"}');
select set_config('request.jwt.claim.sub', :u, false);

do $$ begin
  assert (select count(*) from exams) = 9, 'seed 9 kỳ thi';
  assert (select count(*) from subjects) = 15, 'seed 15 học phần';
end $$;

insert into decks (id, user_id, name, source) values ('22222222-2222-2222-2222-222222222222', auth.uid(), 'TMH', 'apkg');
insert into cards (id, user_id, deck_id, front, back, content_hash) values
  ('c0000000-0000-0000-0000-000000000001', auth.uid(), '22222222-2222-2222-2222-222222222222', 'Q1', 'A1', 'h1'),
  ('c0000000-0000-0000-0000-000000000002', auth.uid(), '22222222-2222-2222-2222-222222222222', 'Q2', 'A2', 'h2');
do $$ begin assert (select count(*) from card_srs) = 2, 'trigger tạo card_srs'; end $$;

insert into clinical_cases (id, user_id, deck_id, title, topic, patient, opening, max_hp, model, prompt_version)
values ('33333333-3333-3333-3333-333333333333', auth.uid(), '22222222-2222-2222-2222-222222222222', 'Ca', 'Bệnh',
        '{}', 'mở đầu', 50, 'test', 'v');
insert into case_steps (id, case_id, step_order, narrative, question, options, hp_penalty, card_ids) values
  ('44444444-4444-4444-4444-444444444441', '33333333-3333-3333-3333-333333333333', 0, 'n', 'q',
   '[{"id":"a","text":"x","is_correct":true,"rationale":"r"},{"id":"b","text":"y","is_correct":false,"rationale":"r"}]', 30,
   '{c0000000-0000-0000-0000-000000000001}'),
  ('44444444-4444-4444-4444-444444444442', '33333333-3333-3333-3333-333333333333', 1, 'n', 'q',
   '[{"id":"a","text":"x","is_correct":true,"rationale":"r"},{"id":"b","text":"y","is_correct":false,"rationale":"r"}]', 30,
   '{c0000000-0000-0000-0000-000000000002}'),
  ('44444444-4444-4444-4444-444444444443', '33333333-3333-3333-3333-333333333333', 2, 'n', 'q',
   '[{"id":"a","text":"x","is_correct":true,"rationale":"r"},{"id":"b","text":"y","is_correct":false,"rationale":"r"}]', 30,
   '{c0000000-0000-0000-0000-000000000001}');
insert into case_cards values ('33333333-3333-3333-3333-333333333333', 'c0000000-0000-0000-0000-000000000001'),
                              ('33333333-3333-3333-3333-333333333333', 'c0000000-0000-0000-0000-000000000002');

do $$ begin assert (select due_cards from case_queue()) = 2, 'case_queue đếm thẻ đến hạn'; end $$;

create temp table run as select * from start_run('33333333-3333-3333-3333-333333333333');
do $$ begin
  assert (select hp from run) = 50, 'run mở với max_hp';
  assert (select id from start_run('33333333-3333-3333-3333-333333333333')) = (select id from run), 'start_run trả lượt đang dở';
end $$;

-- Bước 0: sai (-30)
select submit_case_answer_v2('aaaaaaaa-0000-0000-0000-000000000001', (select id from run), '44444444-4444-4444-4444-444444444441', 'b', null, 1000, now(),
  '[{"card_id":"c0000000-0000-0000-0000-000000000001","rating":"again","state":"learning","due_at":"2030-01-01T00:00:00Z","interval_days":0,"ease":2.5,"reps":1,"lapses":0,"learning_step":0}]');
-- Gửi lại cùng op => không trừ thêm
select submit_case_answer_v2('aaaaaaaa-0000-0000-0000-000000000001', (select id from run), '44444444-4444-4444-4444-444444444441', 'b', null, 1000, now(),
  '[{"card_id":"c0000000-0000-0000-0000-000000000001","rating":"again","state":"learning","due_at":"2030-01-01T00:00:00Z","interval_days":0,"ease":2.5,"reps":1,"lapses":0,"learning_step":0}]');
do $$ begin
  assert (select hp from case_runs) = 20, 'trừ HP đúng 1 lần (idempotent)';
  assert (select current_step from case_runs) = 1, 'sang bước 1';
  assert (select streak_current from profiles) = 1, 'streak = 1';
end $$;

-- Gửi lại bước cũ bằng op khác => STEP_OUT_OF_ORDER
do $$ begin
  perform submit_case_answer_v2(gen_random_uuid(), (select id from case_runs), '44444444-4444-4444-4444-444444444441', 'a', null, 1, now(), '[]');
  raise exception 'phải lỗi';
exception when others then
  assert sqlerrm = 'STEP_OUT_OF_ORDER', 'nhận ' || sqlerrm;
end $$;

-- Bước 1: sai tiếp => chết
select submit_case_answer_v2('aaaaaaaa-0000-0000-0000-000000000002', (select id from run), '44444444-4444-4444-4444-444444444442', 'b', null, 1000, now(),
  '[{"card_id":"c0000000-0000-0000-0000-000000000002","rating":"again","state":"learning","due_at":"2030-01-01T00:00:00Z","interval_days":0,"ease":2.5,"reps":1,"lapses":0,"learning_step":0}]');
do $$ begin
  assert (select status from case_runs) = 'dead', 'bệnh nhân chết';
  assert (select hp from case_runs) = 0, 'HP về 0';
  assert (select incense_needed from tombstones) = 2, 'bia mộ cần 2 nén';
  assert (select patients_killed from profiles) = 1, 'đếm số ca chết';
  assert (select wrong_answers from profiles) = 2, 'đếm câu sai';
end $$;

-- Thắp nhang: hard không tính, good tính
select light_incense((select id from tombstones), 'c0000000-0000-0000-0000-000000000001', 'hard', gen_random_uuid(), now(),
  '{"state":"review","due_at":"2030-01-02T00:00:00Z","interval_days":1,"ease":2.35,"reps":2,"lapses":0,"learning_step":0}');
do $$ begin assert (select incense_lit from tombstones) = 0, 'hard không tính nén'; end $$;
select light_incense((select id from tombstones), 'c0000000-0000-0000-0000-000000000001', 'good', gen_random_uuid(), now(),
  '{"state":"review","due_at":"2030-01-03T00:00:00Z","interval_days":1,"ease":2.35,"reps":3,"lapses":0,"learning_step":0}');
select light_incense((select id from tombstones), 'c0000000-0000-0000-0000-000000000002', 'easy', gen_random_uuid(), now(),
  '{"state":"review","due_at":"2030-01-04T00:00:00Z","interval_days":4,"ease":2.5,"reps":2,"lapses":0,"learning_step":0}');
do $$ begin
  assert (select incense_lit from tombstones) = 2, '2 nén';
  assert (select redeemed_at from tombstones) is not null, 'đã siêu thoát';
  assert (select interval_days from card_srs where card_id = 'c0000000-0000-0000-0000-000000000002') = 4, 'SRS cập nhật';
end $$;

-- Sync feed có ghi nhận thay đổi
do $$ begin assert (select count(*) from sync_events where entity = 'case_runs') >= 3, 'sync_events'; end $$;

-- RLS: user khác không thấy gì
set role authenticated;
select set_config('request.jwt.claim.sub', '99999999-9999-9999-9999-999999999999', false);
do $$ begin
  assert (select count(*) from cards) = 0, 'RLS cards';
  assert (select count(*) from case_steps) = 0, 'RLS case_steps';
  assert (select count(*) from tombstones) = 0, 'RLS tombstones';
end $$;
reset role;

\o
\echo 'SMOKE OK'
