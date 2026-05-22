import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useHostMemberships } from "@/hooks/use-auth";
import { RequireAuth } from "@/components/RequireAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmtEventDate, isPast } from "@/lib/format";
import { ScanLine } from "lucide-react";

export const Route = createFileRoute("/check-in")({
  component: () => <RequireAuth><CheckInIndex /></RequireAuth>,
  head: () => ({ meta: [{ title: "Check-in — Convene" }] }),
});

function CheckInIndex() {
  const { user } = useAuth();
  const { memberships, loading: mLoading } = useHostMemberships(user?.id);
  const hostIds = memberships.map((m) => m.host_id);

  const { data: events, isLoading } = useQuery({
    enabled: hostIds.length > 0,
    queryKey: ["checkin-events", hostIds.join(",")],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, title, slug, starts_at, ends_at, host_id")
        .in("host_id", hostIds)
        .order("starts_at", { ascending: true });
      return (data as any[]) ?? [];
    },
  });

  if (mLoading || isLoading) {
    return <div className="mx-auto max-w-3xl px-4 py-12 text-sm text-muted-foreground">Loading…</div>;
  }

  if (!memberships.length) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 text-center">
        <h1 className="text-2xl font-semibold">No check-in access</h1>
        <p className="mt-2 text-sm text-muted-foreground">You're not a member of any host team yet.</p>
      </div>
    );
  }

  const upcoming = (events ?? []).filter((e) => !isPast(e.ends_at));
  const past = (events ?? []).filter((e) => isPast(e.ends_at));

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Check-in</h1>
      <p className="mt-1 text-sm text-muted-foreground">Pick an event to start checking attendees in.</p>

      <h2 className="mt-8 text-sm font-semibold">Upcoming & live</h2>
      <div className="mt-3 space-y-2">
        {upcoming.length ? upcoming.map((e) => (
          <Card key={e.id} className="flex items-center justify-between p-4">
            <div>
              <Link to="/events/$slug" params={{ slug: e.slug }} className="font-medium hover:underline">{e.title}</Link>
              <p className="text-xs text-muted-foreground">{fmtEventDate(e.starts_at)}</p>
            </div>
            <Button size="sm" asChild>
              <Link to="/check-in/$eventId" params={{ eventId: e.id }}><ScanLine className="mr-1 h-4 w-4" />Open</Link>
            </Button>
          </Card>
        )) : <p className="text-sm text-muted-foreground">No upcoming events.</p>}
      </div>

      {past.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-semibold">Past</h2>
          <div className="mt-3 space-y-2">
            {past.map((e) => (
              <Card key={e.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Link to="/events/$slug" params={{ slug: e.slug }} className="font-medium hover:underline">{e.title}</Link>
                    <Badge variant="secondary">Ended</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{fmtEventDate(e.starts_at)}</p>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/check-in/$eventId" params={{ eventId: e.id }}>Open</Link>
                </Button>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
