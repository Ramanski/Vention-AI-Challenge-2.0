import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EventCard } from "@/components/EventCard";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Convene — Discover community events" },
      { name: "description", content: "Lightweight event hosting and attendance for communities. Discover gatherings, RSVP in seconds." },
    ],
  }),
});

function Index() {
  const { data: events } = useQuery({
    queryKey: ["events", "upcoming-featured"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, slug, title, cover_url, starts_at, ends_at, location, capacity, host:hosts(name, slug)")
        .eq("status", "published")
        .eq("visibility", "public")
        .gte("ends_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(6);
      if (error) throw error;
      return data as any[];
    },
  });

  return (
    <div>
      <section className="gradient-hero relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 py-24 md:py-32">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <Sparkles className="h-3 w-3 text-primary" /> Free to host. No setup.
            </div>
            <h1 className="mt-5 text-5xl font-semibold leading-tight tracking-tight md:text-6xl">
              Gatherings worth <span className="text-gradient">showing up</span> for.
            </h1>
            <p className="mt-5 text-lg text-muted-foreground">
              Discover and RSVP to community events. Hosts, organize attendees, run check-ins, and gather feedback — all in one calm place.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg"><Link to="/events">Explore events <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
              <Button asChild variant="outline" size="lg"><Link to="/become-host">Host your own</Link></Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Upcoming events</h2>
            <p className="mt-1 text-sm text-muted-foreground">Hand-picked happenings from our community.</p>
          </div>
          <Button asChild variant="ghost" size="sm"><Link to="/events">See all <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
        </div>
        {events && events.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {events.map((e) => <EventCard key={e.id} event={e} />)}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No upcoming events yet — check back soon.</p>
        )}
      </section>
    </div>
  );
}
