
-- Enums
CREATE TYPE public.app_role AS ENUM ('user', 'admin');
CREATE TYPE public.host_member_role AS ENUM ('owner', 'checker');
CREATE TYPE public.event_status AS ENUM ('draft', 'published', 'cancelled');
CREATE TYPE public.rsvp_status AS ENUM ('confirmed', 'waitlisted', 'cancelled');
CREATE TYPE public.photo_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.report_target AS ENUM ('event', 'photo', 'feedback', 'user');
CREATE TYPE public.report_status AS ENUM ('open', 'resolved', 'dismissed');

-- Tables (no policies yet)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT, avatar_url TEXT, email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  UNIQUE(user_id, role)
);

CREATE TABLE public.hosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
  bio TEXT, logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.host_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES public.hosts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.host_member_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(host_id, user_id)
);

CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES public.hosts(id) ON DELETE CASCADE,
  title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
  description TEXT, cover_url TEXT,
  starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL,
  location TEXT, capacity INTEGER NOT NULL DEFAULT 50,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  status public.event_status NOT NULL DEFAULT 'published',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.rsvp_status NOT NULL,
  position INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rsvp_id UUID NOT NULL UNIQUE REFERENCES public.rsvps(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE public.checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL UNIQUE REFERENCES public.tickets(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  checked_in_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE TABLE public.gallery_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  status public.photo_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type public.report_target NOT NULL,
  target_id UUID NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status public.report_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.host_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Security definer helpers
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.has_host_role(_user_id UUID, _host_id UUID, _role public.host_member_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.host_members WHERE user_id = _user_id AND host_id = _host_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_host_member(_user_id UUID, _host_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.host_members WHERE user_id = _user_id AND host_id = _host_id)
$$;

CREATE OR REPLACE FUNCTION public.is_event_staff(_user_id UUID, _event_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events e
    JOIN public.host_members hm ON hm.host_id = e.host_id
    WHERE e.id = _event_id AND hm.user_id = _user_id
  )
$$;

-- Policies
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "hosts_select_all" ON public.hosts FOR SELECT USING (true);
CREATE POLICY "hosts_insert_self" ON public.hosts FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "hosts_update_owner" ON public.hosts FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "host_members_select_member" ON public.host_members FOR SELECT
  USING (auth.uid() = user_id OR public.has_host_role(auth.uid(), host_id, 'owner'));
CREATE POLICY "host_members_insert_owner" ON public.host_members FOR INSERT
  WITH CHECK (public.has_host_role(auth.uid(), host_id, 'owner') OR (
    EXISTS (SELECT 1 FROM public.hosts WHERE id = host_id AND owner_id = auth.uid()) AND user_id = auth.uid()
  ));
CREATE POLICY "host_members_delete_owner" ON public.host_members FOR DELETE
  USING (public.has_host_role(auth.uid(), host_id, 'owner'));

CREATE POLICY "events_select_published_or_staff" ON public.events FOR SELECT
  USING (status = 'published' OR public.is_host_member(auth.uid(), host_id));
CREATE POLICY "events_insert_owner" ON public.events FOR INSERT
  WITH CHECK (public.has_host_role(auth.uid(), host_id, 'owner'));
CREATE POLICY "events_update_owner" ON public.events FOR UPDATE
  USING (public.has_host_role(auth.uid(), host_id, 'owner'));
CREATE POLICY "events_delete_owner" ON public.events FOR DELETE
  USING (public.has_host_role(auth.uid(), host_id, 'owner'));

CREATE POLICY "rsvps_select_self_or_staff" ON public.rsvps FOR SELECT
  USING (auth.uid() = user_id OR public.is_event_staff(auth.uid(), event_id));

CREATE POLICY "tickets_select_self_or_staff" ON public.tickets FOR SELECT
  USING (auth.uid() = user_id OR public.is_event_staff(auth.uid(), event_id));

CREATE POLICY "checkins_select_staff_or_self" ON public.checkins FOR SELECT
  USING (public.is_event_staff(auth.uid(), event_id) OR EXISTS (
    SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid()
  ));

CREATE POLICY "feedback_select_all" ON public.feedback FOR SELECT USING (true);
CREATE POLICY "feedback_insert_attendee" ON public.feedback FOR INSERT WITH CHECK (
  auth.uid() = user_id AND rating BETWEEN 1 AND 5 AND EXISTS (
    SELECT 1 FROM public.rsvps r WHERE r.event_id = feedback.event_id AND r.user_id = auth.uid() AND r.status = 'confirmed'
  )
);
CREATE POLICY "feedback_delete_own_or_staff" ON public.feedback FOR DELETE USING (
  auth.uid() = user_id OR public.is_event_staff(auth.uid(), event_id)
);

CREATE POLICY "gallery_select_approved_or_owner_or_staff" ON public.gallery_photos FOR SELECT
  USING (status = 'approved' OR auth.uid() = uploader_id OR public.is_event_staff(auth.uid(), event_id));
CREATE POLICY "gallery_insert_attendee" ON public.gallery_photos FOR INSERT WITH CHECK (
  auth.uid() = uploader_id AND EXISTS (
    SELECT 1 FROM public.rsvps r WHERE r.event_id = gallery_photos.event_id AND r.user_id = auth.uid() AND r.status = 'confirmed'
  )
);
CREATE POLICY "gallery_update_staff" ON public.gallery_photos FOR UPDATE
  USING (public.is_event_staff(auth.uid(), event_id));
CREATE POLICY "gallery_delete_owner_or_staff" ON public.gallery_photos FOR DELETE
  USING (auth.uid() = uploader_id OR public.is_event_staff(auth.uid(), event_id));

CREATE POLICY "reports_select_self_or_staff" ON public.reports FOR SELECT
  USING (auth.uid() = reporter_id OR (event_id IS NOT NULL AND public.is_event_staff(auth.uid(), event_id)));
CREATE POLICY "reports_insert_self" ON public.reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "reports_update_staff" ON public.reports FOR UPDATE
  USING (event_id IS NOT NULL AND public.is_event_staff(auth.uid(), event_id));

-- New user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  -- Claim seeded host on first signup if not yet owned
  UPDATE public.hosts SET owner_id = NEW.id WHERE owner_id IS NULL AND slug = 'lumen-collective';
  INSERT INTO public.host_members (host_id, user_id, role)
    SELECT id, NEW.id, 'owner' FROM public.hosts WHERE slug = 'lumen-collective' AND owner_id = NEW.id
    ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RPCs
CREATE OR REPLACE FUNCTION public.rsvp_to_event(_event_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user UUID := auth.uid();
  _event RECORD;
  _confirmed_count INT;
  _next_pos INT;
  _rsvp public.rsvps;
  _ticket_code TEXT;
  _existing public.rsvps;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO _event FROM public.events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'event not found'; END IF;
  IF _event.status <> 'published' THEN RAISE EXCEPTION 'event not available'; END IF;
  IF _event.ends_at < now() THEN RAISE EXCEPTION 'event ended'; END IF;

  SELECT * INTO _existing FROM public.rsvps WHERE event_id = _event_id AND user_id = _user;
  IF FOUND AND _existing.status IN ('confirmed', 'waitlisted') THEN
    RETURN jsonb_build_object('status', _existing.status, 'already', true);
  END IF;

  SELECT COUNT(*) INTO _confirmed_count FROM public.rsvps WHERE event_id = _event_id AND status = 'confirmed';

  IF _confirmed_count < _event.capacity THEN
    INSERT INTO public.rsvps (event_id, user_id, status) VALUES (_event_id, _user, 'confirmed')
      ON CONFLICT (event_id, user_id) DO UPDATE SET status = 'confirmed', position = NULL
      RETURNING * INTO _rsvp;
    _ticket_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    INSERT INTO public.tickets (rsvp_id, event_id, user_id, code)
      VALUES (_rsvp.id, _event_id, _user, _ticket_code)
      ON CONFLICT (rsvp_id) DO UPDATE SET revoked = false;
    RETURN jsonb_build_object('status', 'confirmed', 'ticket_code', _ticket_code);
  ELSE
    SELECT COALESCE(MAX(position), 0) + 1 INTO _next_pos FROM public.rsvps WHERE event_id = _event_id AND status = 'waitlisted';
    INSERT INTO public.rsvps (event_id, user_id, status, position) VALUES (_event_id, _user, 'waitlisted', _next_pos)
      ON CONFLICT (event_id, user_id) DO UPDATE SET status = 'waitlisted', position = _next_pos
      RETURNING * INTO _rsvp;
    RETURN jsonb_build_object('status', 'waitlisted', 'position', _next_pos);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_rsvp(_event_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user UUID := auth.uid();
  _event RECORD;
  _promote public.rsvps;
  _confirmed_count INT;
  _ticket_code TEXT;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO _event FROM public.events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'event not found'; END IF;

  UPDATE public.rsvps SET status = 'cancelled', position = NULL
    WHERE event_id = _event_id AND user_id = _user;
  UPDATE public.tickets SET revoked = true WHERE event_id = _event_id AND user_id = _user;

  SELECT COUNT(*) INTO _confirmed_count FROM public.rsvps WHERE event_id = _event_id AND status = 'confirmed';
  IF _confirmed_count < _event.capacity THEN
    SELECT * INTO _promote FROM public.rsvps
      WHERE event_id = _event_id AND status = 'waitlisted'
      ORDER BY position ASC NULLS LAST, created_at ASC LIMIT 1;
    IF FOUND THEN
      UPDATE public.rsvps SET status = 'confirmed', position = NULL WHERE id = _promote.id;
      _ticket_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
      INSERT INTO public.tickets (rsvp_id, event_id, user_id, code)
        VALUES (_promote.id, _event_id, _promote.user_id, _ticket_code)
        ON CONFLICT (rsvp_id) DO UPDATE SET revoked = false, code = EXCLUDED.code;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.checkin_by_code(_event_id UUID, _code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user UUID := auth.uid();
  _ticket public.tickets;
  _existing public.checkins;
  _attendee_name TEXT;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT public.is_event_staff(_user, _event_id) THEN RAISE EXCEPTION 'not authorized'; END IF;

  SELECT * INTO _ticket FROM public.tickets WHERE event_id = _event_id AND code = upper(_code) AND revoked = false;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid'); END IF;

  SELECT * INTO _existing FROM public.checkins WHERE ticket_id = _ticket.id;
  IF FOUND THEN
    SELECT full_name INTO _attendee_name FROM public.profiles WHERE id = _ticket.user_id;
    RETURN jsonb_build_object('ok', false, 'reason', 'duplicate', 'attendee', _attendee_name, 'at', _existing.checked_in_at);
  END IF;

  INSERT INTO public.checkins (ticket_id, event_id, checked_in_by) VALUES (_ticket.id, _event_id, _user);
  SELECT full_name INTO _attendee_name FROM public.profiles WHERE id = _ticket.user_id;
  RETURN jsonb_build_object('ok', true, 'attendee', _attendee_name);
END;
$$;

-- Storage buckets and policies
INSERT INTO storage.buckets (id, name, public) VALUES
  ('event-covers', 'event-covers', true),
  ('host-logos', 'host-logos', true),
  ('gallery', 'gallery', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "covers_public_read" ON storage.objects FOR SELECT USING (bucket_id IN ('event-covers','host-logos','gallery'));
CREATE POLICY "covers_authed_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('event-covers','host-logos','gallery'));
CREATE POLICY "covers_authed_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('event-covers','host-logos','gallery') AND owner = auth.uid());
CREATE POLICY "covers_authed_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('event-covers','host-logos','gallery') AND owner = auth.uid());

-- Seed
INSERT INTO public.hosts (owner_id, name, slug, bio, logo_url) VALUES
  (NULL, 'Lumen Collective', 'lumen-collective',
   'A community of builders, designers, and curious minds hosting intimate gatherings around craft and creativity.',
   'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400&h=400&fit=crop');

INSERT INTO public.events (host_id, title, slug, description, cover_url, starts_at, ends_at, location, capacity, status)
SELECT id, 'Founders Mixer', 'founders-mixer',
  'An evening of candid conversations between early-stage founders. Drinks, lightning talks, and open hallway-track discussion.',
  'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1200&h=600&fit=crop',
  now() + interval '7 days', now() + interval '7 days 3 hours',
  'The Loft, 142 Mercer St', 25, 'published'
FROM public.hosts WHERE slug = 'lumen-collective';

INSERT INTO public.events (host_id, title, slug, description, cover_url, starts_at, ends_at, location, capacity, status)
SELECT id, 'Spring Demo Night', 'spring-demo-night',
  'A relaxed showcase of side projects from the community. Ten demos, ten minutes each.',
  'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&h=600&fit=crop',
  now() - interval '14 days', now() - interval '14 days' + interval '3 hours',
  'Studio B, 88 Lafayette', 40, 'published'
FROM public.hosts WHERE slug = 'lumen-collective';
