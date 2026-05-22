import { Link } from "@tanstack/react-router";
import { Calendar, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { fmtEventDate, isPast } from "@/lib/format";

export type EventCardData = {
  id: string;
  slug: string;
  title: string;
  cover_url: string | null;
  starts_at: string;
  ends_at: string;
  location: string | null;
  capacity: number;
  host?: { name: string; slug: string } | null;
};

export function EventCard({ event }: { event: EventCardData }) {
  const past = isPast(event.ends_at);
  return (
    <Link
      to="/events/$slug"
      params={{ slug: event.slug }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card transition-all hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-muted">
        {event.cover_url && (
          <img src={event.cover_url} alt={event.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        )}
        {past && (
          <Badge variant="secondary" className="absolute left-3 top-3">Ended</Badge>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {event.host && <span className="text-xs text-muted-foreground">{event.host.name}</span>}
        <h3 className="line-clamp-2 text-lg font-semibold leading-tight">{event.title}</h3>
        <div className="mt-auto space-y-1.5 pt-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{fmtEventDate(event.starts_at)}</div>
          {event.location && <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{event.location}</div>}
          <div className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />Capacity {event.capacity}</div>
        </div>
      </div>
    </Link>
  );
}
