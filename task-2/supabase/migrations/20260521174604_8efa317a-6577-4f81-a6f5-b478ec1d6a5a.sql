
-- Ensure one feedback per user per event
CREATE UNIQUE INDEX IF NOT EXISTS feedback_event_user_unique ON public.feedback(event_id, user_id);

-- Replace insert policy with stricter rules (event ended + RSVP confirmed/cancelled)
DROP POLICY IF EXISTS feedback_insert_attendee ON public.feedback;

CREATE POLICY feedback_insert_attendee
ON public.feedback
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND rating BETWEEN 1 AND 5
  AND EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = feedback.event_id
      AND e.ends_at < now()
  )
  AND EXISTS (
    SELECT 1 FROM public.rsvps r
    WHERE r.event_id = feedback.event_id
      AND r.user_id = auth.uid()
      AND r.status IN ('confirmed'::rsvp_status, 'cancelled'::rsvp_status)
  )
);
