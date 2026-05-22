
-- Drop dependent policies first
DROP POLICY IF EXISTS events_delete_owner ON public.events;
DROP POLICY IF EXISTS events_insert_owner ON public.events;
DROP POLICY IF EXISTS events_update_owner ON public.events;
DROP POLICY IF EXISTS host_members_delete_owner ON public.host_members;
DROP POLICY IF EXISTS host_members_insert_owner ON public.host_members;
DROP POLICY IF EXISTS host_members_select_member ON public.host_members;

-- Drop function depending on old enum
DROP FUNCTION IF EXISTS public.has_host_role(uuid, uuid, public.host_member_role);

-- Recreate enum
ALTER TYPE public.host_member_role RENAME TO host_member_role_old;
CREATE TYPE public.host_member_role AS ENUM ('host', 'checker');
ALTER TABLE public.host_members
  ALTER COLUMN role TYPE public.host_member_role
  USING (CASE WHEN role::text = 'owner' THEN 'host' ELSE role::text END)::public.host_member_role;
DROP TYPE public.host_member_role_old;

-- Recreate has_host_role
CREATE OR REPLACE FUNCTION public.has_host_role(_user_id uuid, _host_id uuid, _role public.host_member_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.host_members WHERE user_id = _user_id AND host_id = _host_id AND role = _role)
$$;

-- Recreate policies with 'host'
CREATE POLICY events_delete_host ON public.events FOR DELETE
  USING (public.has_host_role(auth.uid(), host_id, 'host'));
CREATE POLICY events_insert_host ON public.events FOR INSERT
  WITH CHECK (public.has_host_role(auth.uid(), host_id, 'host'));
CREATE POLICY events_update_host ON public.events FOR UPDATE
  USING (public.has_host_role(auth.uid(), host_id, 'host'));

CREATE POLICY host_members_select_member ON public.host_members FOR SELECT
  USING (auth.uid() = user_id OR public.has_host_role(auth.uid(), host_id, 'host'));
CREATE POLICY host_members_delete_host ON public.host_members FOR DELETE
  USING (public.has_host_role(auth.uid(), host_id, 'host'));
CREATE POLICY host_members_insert_host ON public.host_members FOR INSERT
  WITH CHECK (
    public.has_host_role(auth.uid(), host_id, 'host')
    OR (EXISTS (SELECT 1 FROM public.hosts h WHERE h.id = host_id AND h.owner_id = auth.uid()) AND user_id = auth.uid())
  );

-- Update handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;

  UPDATE public.hosts SET owner_id = NEW.id WHERE owner_id IS NULL AND slug = 'lumen-collective';
  INSERT INTO public.host_members (host_id, user_id, role)
    SELECT id, NEW.id, 'host'::public.host_member_role FROM public.hosts WHERE slug = 'lumen-collective' AND owner_id = NEW.id
    ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- Backfill any existing seed member rows
UPDATE public.host_members SET role = 'host' WHERE role::text = 'owner';

-- host_invites
CREATE TABLE public.host_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES public.hosts(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.host_member_role NOT NULL DEFAULT 'checker',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18), 'hex'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked','expired')),
  invited_by uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (host_id, email, status)
);
CREATE INDEX idx_host_invites_email ON public.host_invites (lower(email));
ALTER TABLE public.host_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY host_invites_select_host_or_invitee ON public.host_invites FOR SELECT
  USING (
    public.has_host_role(auth.uid(), host_id, 'host')
    OR lower(email) = lower(COALESCE((auth.jwt() ->> 'email'), ''))
  );
CREATE POLICY host_invites_insert_host ON public.host_invites FOR INSERT
  WITH CHECK (public.has_host_role(auth.uid(), host_id, 'host') AND invited_by = auth.uid());
CREATE POLICY host_invites_update_host ON public.host_invites FOR UPDATE
  USING (public.has_host_role(auth.uid(), host_id, 'host'));
CREATE POLICY host_invites_delete_host ON public.host_invites FOR DELETE
  USING (public.has_host_role(auth.uid(), host_id, 'host'));

CREATE OR REPLACE FUNCTION public.accept_host_invite(_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user uuid := auth.uid();
  _email text := lower(COALESCE((auth.jwt() ->> 'email'), ''));
  _inv public.host_invites;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO _inv FROM public.host_invites WHERE token = _token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invite not found'; END IF;
  IF _inv.status <> 'pending' THEN RAISE EXCEPTION 'invite not pending'; END IF;
  IF _inv.expires_at < now() THEN
    UPDATE public.host_invites SET status = 'expired' WHERE id = _inv.id;
    RAISE EXCEPTION 'invite expired';
  END IF;
  IF lower(_inv.email) <> _email THEN RAISE EXCEPTION 'invite email mismatch'; END IF;

  INSERT INTO public.host_members (host_id, user_id, role)
    VALUES (_inv.host_id, _user, _inv.role)
    ON CONFLICT DO NOTHING;
  UPDATE public.host_invites SET status = 'accepted' WHERE id = _inv.id;
  RETURN jsonb_build_object('ok', true, 'host_id', _inv.host_id, 'role', _inv.role);
END;
$$;

-- checkins.undone_at
ALTER TABLE public.checkins ADD COLUMN undone_at timestamptz;
ALTER TABLE public.checkins DROP CONSTRAINT IF EXISTS checkins_ticket_id_key;
CREATE UNIQUE INDEX checkins_ticket_active_unique ON public.checkins (ticket_id) WHERE undone_at IS NULL;

CREATE OR REPLACE FUNCTION public.checkin_by_code(_event_id uuid, _code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user uuid := auth.uid();
  _ticket public.tickets;
  _existing public.checkins;
  _attendee_name text;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT public.is_event_staff(_user, _event_id) THEN RAISE EXCEPTION 'not authorized'; END IF;

  SELECT * INTO _ticket FROM public.tickets WHERE event_id = _event_id AND code = upper(_code) AND revoked = false;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid'); END IF;

  SELECT * INTO _existing FROM public.checkins WHERE ticket_id = _ticket.id AND undone_at IS NULL;
  IF FOUND THEN
    SELECT full_name INTO _attendee_name FROM public.profiles WHERE id = _ticket.user_id;
    RETURN jsonb_build_object('ok', false, 'reason', 'duplicate', 'attendee', _attendee_name, 'at', _existing.checked_in_at);
  END IF;

  INSERT INTO public.checkins (ticket_id, event_id, checked_in_by) VALUES (_ticket.id, _event_id, _user);
  SELECT full_name INTO _attendee_name FROM public.profiles WHERE id = _ticket.user_id;
  RETURN jsonb_build_object('ok', true, 'attendee', _attendee_name);
END;
$$;

CREATE OR REPLACE FUNCTION public.undo_checkin(_checkin_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user uuid := auth.uid();
  _ci public.checkins;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO _ci FROM public.checkins WHERE id = _checkin_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'check-in not found'; END IF;
  IF NOT public.is_event_staff(_user, _ci.event_id) THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE public.checkins SET undone_at = now() WHERE id = _checkin_id AND undone_at IS NULL;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE POLICY checkins_update_staff ON public.checkins FOR UPDATE
  USING (public.is_event_staff(auth.uid(), event_id));

-- Capacity-increase promotion trigger
CREATE OR REPLACE FUNCTION public.promote_waitlist_on_capacity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _confirmed int;
  _slots int;
  _rsvp public.rsvps;
  _code text;
BEGIN
  IF NEW.capacity <= OLD.capacity THEN RETURN NEW; END IF;
  SELECT COUNT(*) INTO _confirmed FROM public.rsvps WHERE event_id = NEW.id AND status = 'confirmed';
  _slots := NEW.capacity - _confirmed;
  WHILE _slots > 0 LOOP
    SELECT * INTO _rsvp FROM public.rsvps
      WHERE event_id = NEW.id AND status = 'waitlisted'
      ORDER BY created_at ASC, position ASC NULLS LAST LIMIT 1;
    EXIT WHEN NOT FOUND;
    UPDATE public.rsvps SET status = 'confirmed', position = NULL WHERE id = _rsvp.id;
    _code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    INSERT INTO public.tickets (rsvp_id, event_id, user_id, code)
      VALUES (_rsvp.id, NEW.id, _rsvp.user_id, _code)
      ON CONFLICT (rsvp_id) DO UPDATE SET revoked = false, code = EXCLUDED.code;
    _slots := _slots - 1;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_events_capacity_promote
  AFTER UPDATE OF capacity ON public.events
  FOR EACH ROW WHEN (NEW.capacity IS DISTINCT FROM OLD.capacity)
  EXECUTE FUNCTION public.promote_waitlist_on_capacity();
