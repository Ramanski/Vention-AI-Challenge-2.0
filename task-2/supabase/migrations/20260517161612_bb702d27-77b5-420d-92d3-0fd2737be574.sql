
DO $$
DECLARE
  u_host    uuid := '11111111-1111-1111-1111-111111111111';
  u_checker uuid := '22222222-2222-2222-2222-222222222222';
  u_a1      uuid := '33333333-3333-3333-3333-333333333333';
  u_a2      uuid := '44444444-4444-4444-4444-444444444444';
  u_a3      uuid := '55555555-5555-5555-5555-555555555555';
  h_id      uuid := '66666666-6666-6666-6666-666666666666';
  e_up      uuid := '77777777-7777-7777-7777-777777777777';
  e_past    uuid := '88888888-8888-8888-8888-888888888888';
  rsvp1     uuid := 'aaaaaaa1-0000-0000-0000-000000000001';
  rsvp2     uuid := 'aaaaaaa2-0000-0000-0000-000000000002';
  rsvp3     uuid := 'aaaaaaa3-0000-0000-0000-000000000003';
  t1        uuid := 'bbbbbbb1-0000-0000-0000-000000000001';
  t2        uuid := 'bbbbbbb2-0000-0000-0000-000000000002';
  starts_up timestamptz;
  ends_up   timestamptz;
  starts_pa timestamptz;
  ends_pa   timestamptz;
  rec       record;
BEGIN
  starts_up := (((now() AT TIME ZONE 'Europe/Warsaw')::date + 7)::text || ' 18:00')::timestamp AT TIME ZONE 'Europe/Warsaw';
  ends_up   := (((now() AT TIME ZONE 'Europe/Warsaw')::date + 7)::text || ' 20:00')::timestamp AT TIME ZONE 'Europe/Warsaw';
  starts_pa := (((now() AT TIME ZONE 'Europe/Warsaw')::date - 7)::text || ' 18:00')::timestamp AT TIME ZONE 'Europe/Warsaw';
  ends_pa   := (((now() AT TIME ZONE 'Europe/Warsaw')::date - 7)::text || ' 20:00')::timestamp AT TIME ZONE 'Europe/Warsaw';

  FOR rec IN
    SELECT * FROM (VALUES
      (u_host,    'host@example.com'),
      (u_checker, 'checker@example.com'),
      (u_a1,      'attendee1@example.com'),
      (u_a2,      'attendee2@example.com'),
      (u_a3,      'attendee3@example.com')
    ) AS t(uid, em)
  LOOP
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', rec.uid, 'authenticated', 'authenticated',
      rec.em, crypt('DemoPass123!', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name',
        CASE rec.em
          WHEN 'host@example.com' THEN 'Demo Host User'
          WHEN 'checker@example.com' THEN 'Demo Checker User'
          WHEN 'attendee1@example.com' THEN 'Demo Attendee One'
          WHEN 'attendee2@example.com' THEN 'Demo Attendee Two'
          WHEN 'attendee3@example.com' THEN 'Demo Attendee Three'
        END),
      now(), now(), '', '', '', ''
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), rec.uid, rec.uid::text,
      jsonb_build_object('sub', rec.uid::text, 'email', rec.em, 'email_verified', true),
      'email', now(), now(), now()
    ) ON CONFLICT DO NOTHING;
  END LOOP;

  INSERT INTO public.profiles (id, full_name, email) VALUES
    (u_host,    'Demo Host User',     'host@example.com'),
    (u_checker, 'Demo Checker User',  'checker@example.com'),
    (u_a1,      'Demo Attendee One',  'attendee1@example.com'),
    (u_a2,      'Demo Attendee Two',  'attendee2@example.com'),
    (u_a3,      'Demo Attendee Three','attendee3@example.com')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email;

  INSERT INTO public.hosts (id, name, slug, bio, contact_email, owner_id)
  VALUES (h_id, 'Wro Community Events', 'wro-community-events',
          'Free community events, meetups, and local workshops in Wroclaw.',
          'host@example.com', u_host)
  ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, slug=EXCLUDED.slug, bio=EXCLUDED.bio,
    contact_email=EXCLUDED.contact_email, owner_id=EXCLUDED.owner_id;

  INSERT INTO public.host_members (host_id, user_id, role) VALUES
    (h_id, u_host,    'host'::public.host_member_role),
    (h_id, u_checker, 'checker'::public.host_member_role)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.events (id, host_id, title, slug, description, starts_at, ends_at,
    timezone, location, capacity, is_paid, status, visibility)
  VALUES (e_up, h_id, 'Community Design Night', 'community-design-night',
    'A free evening meetup for people interested in product design, web apps, and community projects.',
    starts_up, ends_up, 'Europe/Warsaw', 'Wroclaw Market Square', 2, false,
    'published'::public.event_status, 'public'::public.event_visibility)
  ON CONFLICT (id) DO UPDATE SET starts_at=EXCLUDED.starts_at, ends_at=EXCLUDED.ends_at,
    capacity=EXCLUDED.capacity, status=EXCLUDED.status, visibility=EXCLUDED.visibility;

  INSERT INTO public.events (id, host_id, title, slug, description, starts_at, ends_at,
    timezone, location, capacity, is_paid, status, visibility)
  VALUES (e_past, h_id, 'Spring Meetup', 'spring-meetup',
    'A completed community meetup used to demonstrate past event state, feedback, gallery, and reports.',
    starts_pa, ends_pa, 'Europe/Warsaw', 'Wroclaw Nadodrze', 5, false,
    'published'::public.event_status, 'public'::public.event_visibility)
  ON CONFLICT (id) DO UPDATE SET starts_at=EXCLUDED.starts_at, ends_at=EXCLUDED.ends_at;

  INSERT INTO public.rsvps (id, event_id, user_id, status, position) VALUES
    (rsvp1, e_up, u_a1, 'confirmed'::public.rsvp_status, NULL),
    (rsvp2, e_up, u_a2, 'confirmed'::public.rsvp_status, NULL),
    (rsvp3, e_up, u_a3, 'waitlisted'::public.rsvp_status, 1)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.tickets (id, rsvp_id, event_id, user_id, code) VALUES
    (t1, rsvp1, e_up, u_a1, 'DEMO-TICKET-001'),
    (t2, rsvp2, e_up, u_a2, 'DEMO-TICKET-002')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.checkins (ticket_id, event_id, checked_in_by)
  SELECT t1, e_up, u_checker
  WHERE NOT EXISTS (SELECT 1 FROM public.checkins WHERE ticket_id = t1 AND undone_at IS NULL);

  INSERT INTO public.rsvps (event_id, user_id, status)
  SELECT e_past, u_a1, 'confirmed'::public.rsvp_status
  WHERE NOT EXISTS (SELECT 1 FROM public.rsvps WHERE event_id = e_past AND user_id = u_a1);

  INSERT INTO public.gallery_photos (event_id, uploader_id, storage_path, status)
  SELECT e_past, u_a1, 'demo/spring-meetup-approved.jpg', 'approved'::public.photo_status
  WHERE NOT EXISTS (SELECT 1 FROM public.gallery_photos WHERE event_id = e_past AND storage_path = 'demo/spring-meetup-approved.jpg');

  INSERT INTO public.gallery_photos (event_id, uploader_id, storage_path, status)
  SELECT e_past, u_a2, 'demo/spring-meetup-pending.jpg', 'pending'::public.photo_status
  WHERE NOT EXISTS (SELECT 1 FROM public.gallery_photos WHERE event_id = e_past AND storage_path = 'demo/spring-meetup-pending.jpg');

  INSERT INTO public.feedback (event_id, user_id, rating, comment)
  SELECT e_past, u_a1, 5, 'Great meetup, loved the community vibe!'
  WHERE NOT EXISTS (SELECT 1 FROM public.feedback WHERE event_id = e_past AND user_id = u_a1);

  INSERT INTO public.reports (reporter_id, event_id, target_id, target_type, reason, status)
  SELECT u_a2, e_past, e_past, 'event'::public.report_target,
         'Demo report for moderation queue testing.', 'open'::public.report_status
  WHERE NOT EXISTS (SELECT 1 FROM public.reports WHERE event_id = e_past AND reporter_id = u_a2);
END $$;
