import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EventCard } from "@/components/EventCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

export const Route = createFileRoute("/events")({
  component: EventsPage,
  head: () => ({
    meta: [
      { title: "Explore events — Convene" },
      { name: "description", content: "Browse upcoming and past community events. RSVP and join the conversation." },
    ],
  }),
});

function EventsPage() {
  const [q, setQ] = useState("");
  const [location, setLocation] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [includePast, setIncludePast] = useState(false);

  const { data: events, isLoading } = useQuery({
    queryKey: ["events", "explore"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, slug, title, cover_url, starts_at, ends_at, location, capacity, host:hosts(name, slug)")
        .eq("status", "published")
        .eq("visibility", "public")
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const now = Date.now();
  const ql = q.trim().toLowerCase();
  const loc = location.trim().toLowerCase();
  const fromMs = from ? new Date(from).getTime() : null;
  const toMs = to ? new Date(to).getTime() + 86_400_000 : null;

  const filtered = (events ?? []).filter((e) => {
    if (!includePast && new Date(e.ends_at).getTime() < now) return false;
    if (ql && !(e.title.toLowerCase().includes(ql) || e.location?.toLowerCase().includes(ql))) return false;
    if (loc && !e.location?.toLowerCase().includes(loc)) return false;
    const startMs = new Date(e.starts_at).getTime();
    if (fromMs !== null && startMs < fromMs) return false;
    if (toMs !== null && startMs > toMs) return false;
    return true;
  });

  const clear = () => { setQ(""); setLocation(""); setFrom(""); setTo(""); setIncludePast(false); };
  const hasFilters = q || location || from || to || includePast;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Explore events</h1>
      <p className="mt-1 text-sm text-muted-foreground">Find your next gathering.</p>

      <div className="mt-6 rounded-2xl border border-border/60 bg-card p-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search events…" className="pl-9" />
          </div>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" />
          <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
            <Label htmlFor="include-past" className="text-sm">Include past</Label>
            <Switch id="include-past" checked={includePast} onCheckedChange={setIncludePast} />
          </div>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div>
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          {hasFilters && (
            <div className="flex items-end">
              <Button variant="ghost" size="sm" onClick={clear}>Clear filters</Button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events match your filters.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((e) => <EventCard key={e.id} event={e} />)}
          </div>
        )}
      </div>
    </div>
  );
}
