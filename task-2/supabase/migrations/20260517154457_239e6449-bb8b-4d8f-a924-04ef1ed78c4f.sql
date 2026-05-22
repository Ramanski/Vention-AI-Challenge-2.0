DROP TRIGGER IF EXISTS events_promote_waitlist_on_capacity ON public.events;
CREATE TRIGGER events_promote_waitlist_on_capacity
  AFTER UPDATE OF capacity ON public.events
  FOR EACH ROW
  WHEN (NEW.capacity > OLD.capacity)
  EXECUTE FUNCTION public.promote_waitlist_on_capacity();