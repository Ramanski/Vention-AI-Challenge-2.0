DO $$ BEGIN
  CREATE TYPE public.event_visibility AS ENUM ('public', 'unlisted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS visibility public.event_visibility NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS venue_address TEXT,
  ADD COLUMN IF NOT EXISTS online_url TEXT;

-- Tighten select policy: only public+published listed broadly; unlisted accessible via direct link (still selectable but won't appear in listing). Keep existing select policy which allows published or staff. Unlisted filtering happens client-side in /events listing.
