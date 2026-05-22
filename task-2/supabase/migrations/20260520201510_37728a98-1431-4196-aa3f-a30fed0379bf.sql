
CREATE OR REPLACE FUNCTION public.get_event_counts(_event_id uuid)
RETURNS TABLE(event_id uuid, going_count bigint, waitlist_count bigint, checked_in_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id,
    COALESCE((SELECT COUNT(*) FROM public.rsvps r WHERE r.event_id = e.id AND r.status = 'confirmed'), 0),
    COALESCE((SELECT COUNT(*) FROM public.rsvps r WHERE r.event_id = e.id AND r.status = 'waitlisted'), 0),
    COALESCE((SELECT COUNT(*) FROM public.checkins c WHERE c.event_id = e.id AND c.undone_at IS NULL), 0)
  FROM public.events e
  WHERE e.id = _event_id AND e.status = 'published';
$$;

GRANT EXECUTE ON FUNCTION public.get_event_counts(uuid) TO anon, authenticated;
