import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useHostMemberships } from "@/hooks/use-auth";
import { useOpenReportEventIds } from "@/hooks/use-open-reports";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ManageEventPanel } from "./host";
import { fmtEventDate } from "@/lib/format";

export const Route = createFileRoute("/manage/$eventId")({
  component: () => (
    <RequireAuth>
      <ManageEventPage />
    </RequireAuth>
  ),
  head: () => ({ meta: [{ title: "Manage event — Convene" }] }),
});

function ManageEventPage() {
  const { eventId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { memberships, loading: membershipsLoading } = useHostMemberships(user?.id);

  const { data: event, isLoading } = useQuery({
    enabled: !!eventId,
    queryKey: ["manage-event", eventId],
    queryFn: async () => {
      const { data } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle();
      return data as any;
    },
  });

  if (isLoading || membershipsLoading) {
    return <div className="mx-auto max-w-5xl px-4 py-12 text-sm text-muted-foreground">Loading…</div>;
  }

  if (!event) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 text-center">
        <h1 className="text-2xl font-semibold">Event not found</h1>
        <Button asChild className="mt-6" variant="outline"><Link to="/my-events">Back to My events</Link></Button>
      </div>
    );
  }

  const isHost = memberships.some((m) => m.host_id === event.host_id && m.role === "host");
  if (!isHost) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 text-center">
        <h1 className="text-2xl font-semibold">Not authorized</h1>
        <p className="mt-2 text-sm text-muted-foreground">You need host access for this event.</p>
        <Button asChild className="mt-6" variant="outline"><Link to="/my-events">Back to My events</Link></Button>
      </div>
    );
  }

  const { data: reportedIds } = useOpenReportEventIds(event ? [event.id] : []);
  const hasOpenReports = !!reportedIds?.has(event.id);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Manage event</p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{event.title}</h1>
            {hasOpenReports && <Badge variant="destructive">Open reports</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{fmtEventDate(event.starts_at)}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm"><Link to="/events/$slug" params={{ slug: event.slug }}>View public page</Link></Button>
          <Button asChild variant="outline" size="sm"><Link to="/host">Host dashboard</Link></Button>
        </div>
      </div>
      <ManageEventPanel event={event} onClose={() => navigate({ to: "/my-events" })} />
    </div>
  );
}
