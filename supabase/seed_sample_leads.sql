-- SAMPLE leads for demos (brief §11: 60 leads across all stages and categories). Phones are the brief's
-- sample range +91 90000 000xx. Every touchpoint note says SAMPLE so they can be removed before launch:
--   delete from public.leads where id in (select lead_id from public.lead_touchpoints where note = 'SAMPLE');
-- Safe to re-run: capture_lead de-duplicates by phone.
do $$
declare
  i int;
  v_id uuid;
  names text[] := array['Lakshmi Prasad','Venkatesh Rao','Sunitha Reddy','Mahesh Goud','Kavitha N','Srinivas K','Padma Devi','Ravi Teja','Anitha M','Prakash V','Swapna R','Naveen Kumar'];
  students text[] := array['Rahul','Asha','Karthik','Divya','Sai Charan','Keerthana','Varun','Harshitha','Rohith','Sri Vaishnavi','Abhinav','Meghana'];
  sources text[] := array['callback','brochure','fee_calculator','bsat','school_data','walk_in','chat','exit_popup'];
  programs text[] := array['iit-jee','neet','long-term-jee','long-term-neet'];
  schools text[] := array['ZPHS Saroornagar','Narayana EM School','Sri Chaitanya School','Kendriya Vidyalaya','Gowtham Model School'];
  areas text[] := array['Saroornagar','Dilsukhnagar','LB Nagar','Kothapet','Vanasthalipuram','Hayathnagar'];
  cats public.lead_category[] := array['hot','warm','cold','invalid']::public.lead_category[];
  statuses public.lead_status[] := array['open','visit_scheduled','visited','counselled','decision_pending','confirmed','lost','open']::public.lead_status[];
  stages public.admission_stage[] := array['enquiry','visit','visit','counselling','counselling','application','enquiry','enquiry']::public.admission_stage[];
begin
  for i in 1..60 loop
    select c.lead_id into v_id from public.capture_lead(jsonb_build_object(
      'phone', '+91900000' || lpad(i::text, 4, '0'),
      'name', names[1 + (i - 1) % 12],
      'student_name', students[1 + (i * 5) % 12],
      'student_class', case when i % 3 = 0 then 'Completed Class 12' else 'Class 10' end,
      'program', programs[1 + (i - 1) % 4],
      'source', sources[1 + (i - 1) % 8],
      'consent', true,
      'note', 'SAMPLE'
    )) c;
    update public.leads set
      parent_name  = names[1 + (i - 1) % 12],
      school       = schools[1 + (i - 1) % 5],
      area         = areas[1 + (i - 1) % 6],
      board        = case when i % 4 = 0 then 'CBSE' else 'SSC (Telangana)' end,
      category     = case when i % 10 = 0 then null else cats[1 + (i - 1) % 4] end,
      status       = case when (i - 1) % 4 = 3 then 'invalid'::public.lead_status else statuses[1 + (i - 1) % 8] end,
      stage        = case when (i - 1) % 4 = 3 then 'enquiry'::public.admission_stage else stages[1 + (i - 1) % 8] end,
      lost_reason  = case when statuses[1 + (i - 1) % 8] = 'lost' and (i - 1) % 4 <> 3 then (array['fees','distance','competitor','not_interested'])[1 + i % 4] end,
      lost_competitor = case when statuses[1 + (i - 1) % 8] = 'lost' and (i - 1) % 4 <> 3 and 1 + i % 4 = 3 then 'Another coaching college' end,
      next_follow_up_at = case when (i - 1) % 4 = 3 or statuses[1 + (i - 1) % 8] in ('lost') then null else now() + make_interval(hours => ((i % 7) - 3) * 24) end,
      last_contact_at = case when i % 3 = 0 then null else now() - make_interval(hours => i) end,
      created_at   = now() - make_interval(days => i % 30)
    where id = v_id;
  end loop;
end $$;
