import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useHostMemberships } from "@/hooks/use-auth";
import { RequireAuth } from "@/components/RequireAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtEventDate, isPast } from "@/lib/format";
import { useOpenReportEventIds } from "@/hooks/use-open-reports";
import { toast } from "sonner";

export const Route = createFileRoute("/my-events")({
  component: () => (
    <RequireAuth>
      <MyEventsPage />
    </RequireAuth>
  ),
  head: () => ({ meta: [{ title: "My events — Convene" }] }),
});

type RoleEvent = {
  id: string;
  slug: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  status: string;
  host_id: string;
  host_name: string;
  host_slug: string;
  role: "host" | "checker";
};

function MyEventsPage() {
  const { user } = useAuth();
  const { memberships, loading: membershipsLoading } = useHostMemberships(user?.id);

  const hostIds = memberships.map((m) => m.host_id);
  const roleByHost = new Map(memberships.map((m) => [m.host_id, m.role]));
  const hostMetaById = new Map(memberships.map((m) => [m.host_id, m.host]));

  const { data: events, isLoading } = useQuery({
    enabled: !!user && hostIds.length > 0,
    queryKey: ["my-events-by-role", user?.id, hostIds.join(",")],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, slug, title, starts_at, ends_at, location, status, host_id")
        .in("host_id", hostIds)
        .order("starts_at", { ascending: false });
      return ((data as any[]) ?? []).map<RoleEvent>((e) => ({
        ...e,
        host_name: hostMetaById.get(e.host_id)?.name ?? "",
        host_slug: hostMetaById.get(e.host_id)?.slug ?? "",
        role: (roleByHost.get(e.host_id) ?? "checker") as "host" | "checker",
      }));
    },
  });

  const [search, setSearch] = useState("");
  const [hostFilter, setHostFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const startTs = startDate ? new Date(startDate).getTime() : null;
    const endTs = endDate ? new Date(endDate).getTime() + 24 * 60 * 60 * 1000 - 1 : null;
    return (events ?? []).filter((e) => {
      if (hostFilter !== "all" && e.host_id !== hostFilter) return false;
      if (q && !e.title.toLowerCase().includes(q) && !e.host_name.toLowerCase().includes(q)) return false;
      const ts = new Date(e.starts_at).getTime();
      if (startTs !== null && ts < startTs) return false;
      if (endTs !== null && ts > endTs) return false;
      return true;
    });
  }, [events, search, hostFilter, startDate, endDate]);

  const upcoming = filtered.filter((e) => !isPast(e.ends_at));
  const past = filtered.filter((e) => isPast(e.ends_at));
  const allEventIds = (events ?? []).map((e) => e.id);
  const { data: reportedIds } = useOpenReportEventIds(allEventIds);

  const loading = membershipsLoading || isLoading;
  const hasRoles = hostIds.length > 0;
  const hasFilters = !!(search || hostFilter !== "all" || startDate || endDate);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">My events</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Events from hosts where you're a host or checker.
      </p>

      {!loading && !hasRoles && (
        <Card className="mt-8 p-6 text-sm text-muted-foreground">
          You don't have any host or checker roles yet.{" "}
          <Link to="/become-host" className="underline">Become a host</Link> or ask an
          existing host to invite you.
        </Card>
      )}

      {hasRoles && (
        <>
          <Card className="mt-6 flex flex-wrap items-end gap-3 p-4">
            <div className="min-w-[180px] flex-1">
              <label className="mb-1 block text-xs text-muted-foreground">Search</label>
              <Input
                placeholder="Title or host…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="min-w-[160px]">
              <label className="mb-1 block text-xs text-muted-foreground">Host</label>
              <Select value={hostFilter} onValueChange={setHostFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Hosts</SelectItem>
                  {memberships.map((m) => (
                    <SelectItem key={m.host_id} value={m.host_id}>{m.host.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">From</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">To</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSearch(""); setHostFilter("all"); setStartDate(""); setEndDate(""); }}
              >
                Clear
              </Button>
            )}
          </Card>

          <section className="mt-8">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Upcoming</h2>
            <div className="mt-3 space-y-3">
              {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {!loading && !upcoming.length && (
                <p className="text-sm text-muted-foreground">
                  {hasFilters ? "No upcoming events match your filters." : "No upcoming events."}
                </p>
              )}
              {upcoming.map((e) => (
                <EventRow key={e.id} event={e} reported={reportedIds?.has(e.id)} />
              ))}
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Past</h2>
            <div className="mt-3 space-y-3">
              {!loading && !past.length && (
                <p className="text-sm text-muted-foreground">
                  {hasFilters ? "No past events match your filters." : "No past events."}
                </p>
              )}
              {past.map((e) => (
                <EventRow key={e.id} event={e} reported={reportedIds?.has(e.id)} ended />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function exportEventCsv(event: RoleEvent) {
  const { data: rsvps, error } = await supabase
    .from("rsvps")
    .select("user_id, status")
    .eq("event_id", event.id)
    .in("status", ["confirmed", "waitlisted", "cancelled"]);
  if (error) throw error;

  const userIds = Array.from(new Set((rsvps ?? []).map((r) => r.user_id)));
  let profileById = new Map<string, { full_name: string | null; email: string | null }>();
  if (userIds.length) {
    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);
    if (pErr) throw pErr;
    profileById = new Map((profiles ?? []).map((p) => [p.id, { full_name: p.full_name, email: p.email }]));
  }

  const { data: checkins, error: cErr } = await supabase
    .from("checkins")
    .select("checked_in_at, tickets:ticket_id(user_id)")
    .eq("event_id", event.id)
    .is("undone_at", null);
  if (cErr) throw cErr;
  const checkinByUser = new Map<string, string>();
  for (const c of (checkins ?? []) as any[]) {
    const uid = c.tickets?.user_id;
    if (uid && !checkinByUser.has(uid)) checkinByUser.set(uid, c.checked_in_at);
  }

  const statusLabel: Record<string, string> = {
    confirmed: "going",
    waitlisted: "waitlist",
    cancelled: "cancelled",
  };
  const header = ["name", "email", "rsvp_status", "check_in_time"];
  const rows = (rsvps ?? []).map((r) => {
    const p = profileById.get(r.user_id);
    return [
      p?.full_name ?? "",
      p?.email ?? "",
      statusLabel[r.status] ?? r.status,
      checkinByUser.get(r.user_id) ?? "",
    ];
  });
  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${event.slug || event.id}-rsvps.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function EventRow({ event, reported, ended }: { event: RoleEvent; reported?: boolean; ended?: boolean }) {
  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await exportEventCsv(event);
      toast.success("Export started");
    } catch (err) {
      console.error("Export failed", err);
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };
  return (
    <Card className={`flex flex-wrap items-center justify-between gap-3 p-5 ${ended ? "opacity-80" : ""}`}>
      <div className="min-w-0 flex-1">
        <Link to="/events/$slug" params={{ slug: event.slug }} className="block truncate text-lg font-semibold hover:underline">
          {event.title}
        </Link>
        <div className="mt-1 text-sm text-muted-foreground">
          {fmtEventDate(event.starts_at)}
          {event.location ? ` · ${event.location}` : ""}
          {event.host_name ? ` · ${event.host_name}` : ""}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {reported && <Badge variant="destructive">Open reports</Badge>}
        <Badge variant={event.status === "published" ? "default" : "secondary"}>
          {event.status}
        </Badge>
        <Badge variant="outline">{event.role}</Badge>
        {event.role === "host" ? (
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/manage/$eventId" params={{ eventId: event.id }}>Manage</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
              {exporting ? "Exporting…" : "Export"}
            </Button>
          </>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link to="/check-in/$eventId" params={{ eventId: event.id }}>Open Check-in</Link>
          </Button>
        )}
      </div>
    </Card>
  );
}
