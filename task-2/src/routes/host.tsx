import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useHostMemberships } from "@/hooks/use-auth";
import { useOpenReportEventIds } from "@/hooks/use-open-reports";
import { RequireAuth } from "@/components/RequireAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtEventDate, isPast } from "@/lib/format";
import { toast } from "sonner";
import { exportEventRsvpsCsv } from "@/lib/export-rsvps";
import { Plus, Download, UserPlus, Check, X, Upload, Pencil, Copy, Eye, EyeOff } from "lucide-react";
import { GalleryLightbox } from "@/components/GalleryLightbox";

export const Route = createFileRoute("/host")({ component: () => <RequireAuth><HostDashboard /></RequireAuth>, head: () => ({ meta: [{ title: "Host dashboard — Convene" }] }) });

function slugify(s: string) { return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60); }

function HostDashboard() {
  const { user } = useAuth();
  const { memberships } = useHostMemberships(user?.id);
  const owned = memberships.filter((m) => m.role === "host");
  const [hostId, setHostId] = useState<string>("");
  const activeId = hostId || owned[0]?.host_id;

  if (!owned.length) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 text-center">
        <h1 className="text-2xl font-semibold">No host yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">Create a host profile to start publishing events.</p>
        <Button asChild className="mt-6"><Link to="/become-host">Become a host</Link></Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Host dashboard</h1>
        {owned.length > 1 && (
          <Select value={activeId} onValueChange={setHostId}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>{owned.map((m) => <SelectItem key={m.host_id} value={m.host_id}>{m.host.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>
      {activeId && <HostBody hostId={activeId} />}
    </div>
  );
}

function HostBody({ hostId }: { hostId: string }) {
  const qc = useQueryClient();
  const { data: events } = useQuery({
    queryKey: ["host-events", hostId],
    queryFn: async () => {
      const { data } = await supabase.from("events").select("*").eq("host_id", hostId).order("starts_at", { ascending: false });
      return (data as any[]) ?? [];
    },
  });

  const upcoming = (events ?? []).filter((e) => !isPast(e.ends_at));
  const past = (events ?? []).filter((e) => isPast(e.ends_at));
  const eventIds = (events ?? []).map((e) => e.id);
  const { data: reportedIds } = useOpenReportEventIds(eventIds);

  return (
    <Tabs defaultValue="events" className="mt-8">
      <TabsList>
        <TabsTrigger value="events">Events</TabsTrigger>
        <TabsTrigger value="members">Team</TabsTrigger>
      </TabsList>
      <TabsContent value="events" className="mt-6">
        <div className="mb-4 flex justify-end"><CreateEventButton hostId={hostId} onCreated={() => qc.invalidateQueries({ queryKey: ["host-events", hostId] })} /></div>
        <Tabs defaultValue="upcoming">
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
            <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="upcoming" className="mt-4 space-y-3">
            {upcoming.length ? upcoming.map((e) => <EventRow key={e.id} event={e} hostId={hostId} reported={!!reportedIds?.has(e.id)} />) : <p className="text-sm text-muted-foreground">No upcoming events.</p>}
          </TabsContent>
          <TabsContent value="past" className="mt-4 space-y-3">
            {past.length ? past.map((e) => <EventRow key={e.id} event={e} hostId={hostId} reported={!!reportedIds?.has(e.id)} />) : <p className="text-sm text-muted-foreground">No past events.</p>}
          </TabsContent>
        </Tabs>
      </TabsContent>
      <TabsContent value="members" className="mt-6"><MembersPanel hostId={hostId} /></TabsContent>
    </Tabs>
  );
}

function useEventCounts(eventId: string) {
  return useQuery({
    queryKey: ["event-counts-row", eventId],
    queryFn: async () => {
      const [g, w, c] = await Promise.all([
        supabase.from("rsvps").select("id", { count: "exact", head: true }).eq("event_id", eventId).eq("status", "confirmed"),
        supabase.from("rsvps").select("id", { count: "exact", head: true }).eq("event_id", eventId).eq("status", "waitlisted"),
        supabase.from("checkins").select("id", { count: "exact", head: true }).eq("event_id", eventId).is("undone_at", null),
      ]);
      return { going: g.count ?? 0, waitlist: w.count ?? 0, checkedIn: c.count ?? 0 };
    },
  });
}

function EventRowCounts({ eventId }: { eventId: string }) {
  const { data } = useEventCounts(eventId);
  return (
    <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
      <span><span className="font-medium text-foreground">{data?.going ?? 0}</span> going</span>
      <span><span className="font-medium text-foreground">{data?.waitlist ?? 0}</span> waitlist</span>
      <span><span className="font-medium text-foreground">{data?.checkedIn ?? 0}</span> checked in</span>
    </div>
  );
}

function EventRow({ event, hostId, reported }: { event: any; hostId: string; reported?: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  async function setStatus(status: "draft" | "published") {
    const { error } = await supabase.from("events").update({ status }).eq("id", event.id);
    if (error) return toast.error(error.message);
    toast.success(status === "published" ? "Published" : "Unpublished");
    qc.invalidateQueries({ queryKey: ["host-events", hostId] });
  }

  async function duplicate() {
    const slug = slugify(event.title) + "-" + Math.random().toString(36).slice(2, 6);
    const { error } = await supabase.from("events").insert({
      host_id: hostId,
      title: event.title + " (copy)",
      slug,
      description: event.description,
      cover_url: event.cover_url,
      location: event.location,
      venue_address: event.venue_address,
      online_url: event.online_url,
      starts_at: event.starts_at,
      ends_at: event.ends_at,
      timezone: event.timezone ?? "UTC",
      capacity: event.capacity,
      visibility: event.visibility ?? "public",
      status: "draft",
    });
    if (error) return toast.error(error.message);
    toast.success("Duplicated as draft");
    qc.invalidateQueries({ queryKey: ["host-events", hostId] });
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link to="/events/$slug" params={{ slug: event.slug }} className="text-lg font-semibold hover:underline">{event.title}</Link>
            {isPast(event.ends_at) && <Badge variant="secondary">Ended</Badge>}
            {event.status !== "published" && <Badge variant="outline">{event.status}</Badge>}
            {event.visibility === "unlisted" && <Badge variant="outline">unlisted</Badge>}
            {reported && <Badge variant="destructive">Open reports</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{fmtEventDate(event.starts_at)} · capacity {event.capacity}</p>
          <EventRowCounts eventId={event.id} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Pencil className="mr-1 h-3.5 w-3.5" />Edit</Button>
          {event.status === "published" ? (
            <Button variant="outline" size="sm" onClick={() => setStatus("draft")}><EyeOff className="mr-1 h-3.5 w-3.5" />Unpublish</Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setStatus("published")}><Eye className="mr-1 h-3.5 w-3.5" />Publish</Button>
          )}
          <Button variant="outline" size="sm" onClick={duplicate}><Copy className="mr-1 h-3.5 w-3.5" />Duplicate</Button>
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Manage</Button>
          <Button variant="outline" size="sm" asChild><Link to="/check-in/$eventId" params={{ eventId: event.id }}>Check-in</Link></Button>
        </div>
      </div>
      {open && <ManageEventPanel event={event} onClose={() => setOpen(false)} />}
      {editOpen && <EventDialog hostId={hostId} event={event} open={editOpen} onOpenChange={setEditOpen} onSaved={() => qc.invalidateQueries({ queryKey: ["host-events", hostId] })} />}
    </Card>
  );
}

export function ManageEventPanel({ event, onClose }: { event: any; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: rsvps } = useQuery({
    queryKey: ["rsvps", event.id],
    queryFn: async () => {
      const { data: rs } = await supabase.from("rsvps")
        .select("id, status, position, user_id")
        .eq("event_id", event.id).order("created_at", { ascending: true });
      const rows = (rs as any[]) ?? [];
      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      let profileById = new Map<string, { full_name: string | null; email: string | null }>();
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
        profileById = new Map((profs ?? []).map((p: any) => [p.id, { full_name: p.full_name, email: p.email }]));
      }
      return rows.map((r) => ({ ...r, profile: profileById.get(r.user_id) ?? null }));
    },
  });
  const { data: checkins } = useQuery({
    queryKey: ["checkins", event.id],
    queryFn: async () => {
      const { data } = await supabase.from("checkins")
        .select("ticket_id, checked_in_at, ticket:tickets(user_id)")
        .eq("event_id", event.id)
        .is("undone_at", null);
      return (data as any[]) ?? [];
    },
  });
  const { data: pendingPhotos } = useQuery({
    queryKey: ["pending-photos", event.id],
    queryFn: async () => {
      const { data } = await supabase.from("gallery_photos").select("*").eq("event_id", event.id).eq("status", "pending");
      return (data as any[]) ?? [];
    },
  });
  const { data: reports } = useQuery({
    queryKey: ["reports", event.id],
    queryFn: async () => {
      const { data } = await supabase.from("reports").select("*").eq("event_id", event.id).order("created_at", { ascending: false });
      const rows = (data as any[]) ?? [];
      const photoIds = rows.filter((r) => r.target_type === "photo").map((r) => r.target_id);
      let photoMap = new Map<string, string>();
      if (photoIds.length) {
        const { data: photos } = await supabase.from("gallery_photos").select("id, storage_path").in("id", photoIds);
        photoMap = new Map((photos ?? []).map((p: any) => [p.id, supabase.storage.from("gallery").getPublicUrl(p.storage_path).data.publicUrl]));
      }
      return rows.map((r) => ({ ...r, photo_url: r.target_type === "photo" ? photoMap.get(r.target_id) ?? null : null }));
    },
  });

  const checkinMap = new Map((checkins ?? []).map((c) => [c.ticket?.user_id, c.checked_in_at]));

  const [exporting, setExporting] = useState(false);
  const [galleryLightbox, setGalleryLightbox] = useState<number | null>(null);

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      await exportEventRsvpsCsv(event, { attendanceOnly: false });
      toast.success("Export started");
    } catch (err) {
      console.error("Export failed", err);
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  }


  async function moderatePhoto(id: string, status: "approved" | "rejected") {
    const { error } = await supabase.from("gallery_photos").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["pending-photos", event.id] });
    qc.invalidateQueries({ queryKey: ["gallery", event.id] });
  }

  async function hideReportedTarget(r: any) {
    if (r.target_type === "event") {
      const { error } = await supabase.from("events").update({ status: "draft" }).eq("id", r.target_id);
      if (error) return toast.error(error.message);
      toast.success("Event hidden from public");
    } else if (r.target_type === "photo") {
      const { error } = await supabase.from("gallery_photos").update({ status: "rejected" }).eq("id", r.target_id);
      if (error) return toast.error(error.message);
      toast.success("Photo hidden");
    }
    await supabase.from("reports").update({ status: "resolved" }).eq("id", r.id);
    qc.invalidateQueries({ queryKey: ["reports", event.id] });
    qc.invalidateQueries({ queryKey: ["host-events", event.host_id] });
    qc.invalidateQueries({ queryKey: ["open-reports-by-event"] });
  }

  async function resolveReport(id: string, status: "resolved" | "dismissed") {
    const { error } = await supabase.from("reports").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["reports", event.id] });
    qc.invalidateQueries({ queryKey: ["open-reports-by-event"] });
  }

  const openReports = (reports ?? []).filter((r) => r.status === "open");
  const reportedPhotoIds = new Set(openReports.filter((r) => r.target_type === "photo").map((r) => r.target_id));

  return (
    <div className="mt-4 border-t border-border/60 pt-4">
      {openReports.length > 0 && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          <span><Badge variant="destructive" className="mr-2">Open reports</Badge>{openReports.length} item{openReports.length === 1 ? "" : "s"} need review</span>
        </div>
      )}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}><Download className="mr-1 h-4 w-4" />{exporting ? "Exporting…" : "Export CSV"}</Button>
        <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </div>


      <Tabs defaultValue="attendees" className="mt-4">
        <TabsList>
          <TabsTrigger value="attendees">Attendees</TabsTrigger>
          <TabsTrigger value="gallery">Gallery ({pendingPhotos?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="reports">Reports ({(reports ?? []).filter((r) => r.status === "open").length})</TabsTrigger>
        </TabsList>
        <TabsContent value="attendees" className="mt-3">
          <div className="overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full text-sm">
              <thead className="bg-muted/50"><tr><th className="p-2 text-left">Name</th><th className="p-2 text-left">Email</th><th className="p-2 text-left">Status</th><th className="p-2 text-left">Checked in</th></tr></thead>
              <tbody>
                {(rsvps ?? []).map((r) => (
                  <tr key={r.id} className="border-t border-border/60">
                    <td className="p-2">{r.profile?.full_name ?? "—"}</td>
                    <td className="p-2 text-muted-foreground">{r.profile?.email}</td>
                    <td className="p-2"><Badge variant={r.status === "confirmed" ? "default" : "outline"}>{r.status}{r.status === "waitlisted" ? ` #${r.position}` : ""}</Badge></td>
                    <td className="p-2 text-muted-foreground">{checkinMap.get(r.user_id) ? new Date(checkinMap.get(r.user_id)!).toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="gallery" className="mt-3">
          {pendingPhotos?.length ? (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {pendingPhotos.map((p, i) => {
                  const url = supabase.storage.from("gallery").getPublicUrl(p.storage_path).data.publicUrl;
                  return (
                    <div key={p.id} className="rounded-lg border border-border/60 p-2">
                      <div className="relative">
                        <button type="button" onClick={() => setGalleryLightbox(i)} className="block w-full overflow-hidden rounded" aria-label="Open photo">
                          <img src={url} alt="" className="aspect-square w-full rounded object-cover" />
                        </button>
                        {reportedPhotoIds.has(p.id) && <Badge variant="destructive" className="absolute left-1 top-1">Reported</Badge>}
                      </div>
                      <div className="mt-2 flex gap-1">
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => moderatePhoto(p.id, "approved")}><Check className="h-3 w-3" /></Button>
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => moderatePhoto(p.id, "rejected")}><X className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <GalleryLightbox
                items={pendingPhotos.map((p) => ({
                  id: p.id,
                  url: supabase.storage.from("gallery").getPublicUrl(p.storage_path).data.publicUrl,
                  caption: reportedPhotoIds.has(p.id) ? <Badge variant="destructive">Reported</Badge> : null,
                  actions: (
                    <>
                      <Button size="sm" variant="secondary" onClick={async () => { await moderatePhoto(p.id, "approved"); setGalleryLightbox(null); }}><Check className="mr-1 h-3 w-3" />Approve</Button>
                      <Button size="sm" variant="destructive" onClick={async () => { await moderatePhoto(p.id, "rejected"); setGalleryLightbox(null); }}><X className="mr-1 h-3 w-3" />Reject</Button>
                    </>
                  ),
                }))}
                index={galleryLightbox}
                onIndexChange={setGalleryLightbox}
                onClose={() => setGalleryLightbox(null)}
              />
            </>
          ) : <p className="text-sm text-muted-foreground">No pending photos.</p>}
        </TabsContent>
        <TabsContent value="reports" className="mt-3 space-y-2">
          {reports?.length ? reports.map((r) => (
            <Card key={r.id} className="p-3">
              <div className="flex items-start gap-3">
                {r.target_type === "photo" && r.photo_url && (
                  <img src={r.photo_url} alt="" className="h-16 w-16 shrink-0 rounded object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="capitalize">{r.target_type}</Badge>
                    <Badge variant={r.status === "open" ? "destructive" : "outline"} className="capitalize">{r.status}</Badge>
                    <span>{new Date(r.created_at).toLocaleString()}</span>
                    {r.target_type === "event" && <span className="truncate">· {event.title}</span>}
                  </div>
                  <p className="mt-1 text-sm">{r.reason}</p>
                </div>
                {r.status === "open" && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button size="sm" variant="destructive" onClick={() => hideReportedTarget(r)}>Hide</Button>
                    <Button size="sm" variant="outline" onClick={() => resolveReport(r.id, "resolved")}>Resolve</Button>
                    <Button size="sm" variant="ghost" onClick={() => resolveReport(r.id, "dismissed")}>Dismiss</Button>
                  </div>
                )}
              </div>
            </Card>
          )) : <p className="text-sm text-muted-foreground">No reports.</p>}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function getTimezones(): string[] {
  try {
    const fn = (Intl as any).supportedValuesOf;
    if (typeof fn === "function") return fn.call(Intl, "timeZone");
  } catch {}
  return ["UTC", "America/Los_Angeles", "America/New_York", "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Tokyo", "Asia/Singapore", "Australia/Sydney"];
}

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function CreateEventButton({ hostId, onCreated }: { hostId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />New event</Button>
      {open && <EventDialog hostId={hostId} open={open} onOpenChange={setOpen} onSaved={onCreated} />}
    </>
  );
}

function EventDialog({ hostId, event, open, onOpenChange, onSaved }: { hostId: string; event?: any; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const isEdit = !!event;
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [coverUrl, setCoverUrl] = useState(event?.cover_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState<"venue" | "online">(event?.online_url ? "online" : "venue");
  const [venueAddress, setVenueAddress] = useState(event?.venue_address ?? event?.location ?? "");
  const [onlineUrl, setOnlineUrl] = useState(event?.online_url ?? "");
  const [startsAt, setStartsAt] = useState(toLocalInput(event?.starts_at) || "");
  const [endsAt, setEndsAt] = useState(toLocalInput(event?.ends_at) || "");
  const [timezone, setTimezone] = useState<string>(event?.timezone ?? browserTz);
  const [capacity, setCapacity] = useState<number>(event?.capacity ?? 50);
  const [visibility, setVisibility] = useState<"public" | "unlisted">(event?.visibility ?? "public");
  const [status, setStatus] = useState<"draft" | "published">(event?.status === "draft" ? "draft" : "published");
  const [isPaid, setIsPaid] = useState(event?.is_paid ?? false);
  const [saving, setSaving] = useState(false);
  const timezones = getTimezones();

  async function uploadCover(file: File) {
    if (file.size > 5 * 1024 * 1024) return toast.error("Max 5MB");
    setUploading(true);
    const path = `${hostId}/${Date.now()}-${file.name.replace(/[^a-z0-9.]+/gi, "-")}`;
    const { error } = await supabase.storage.from("event-covers").upload(path, file, { upsert: false });
    if (error) { setUploading(false); return toast.error(error.message); }
    const { data } = supabase.storage.from("event-covers").getPublicUrl(path);
    setCoverUrl(data.publicUrl);
    setUploading(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return toast.error("Title required");
    if (!startsAt || !endsAt) return toast.error("Set start and end");
    if (new Date(endsAt) <= new Date(startsAt)) return toast.error("End must be after start");
    if (mode === "venue" && !venueAddress.trim()) return toast.error("Venue address required");
    if (mode === "online" && !onlineUrl.trim()) return toast.error("Online link required");
    if (capacity < 1) return toast.error("Capacity must be ≥ 1");

    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      cover_url: coverUrl || null,
      venue_address: mode === "venue" ? venueAddress.trim() : null,
      online_url: mode === "online" ? onlineUrl.trim() : null,
      location: mode === "venue" ? venueAddress.trim() : onlineUrl.trim(),
      starts_at: new Date(startsAt).toISOString(),
      ends_at: new Date(endsAt).toISOString(),
      timezone,
      capacity,
      visibility,
      status,
      is_paid: false,
    };

    if (isEdit) {
      const { error } = await supabase.from("events").update(payload).eq("id", event.id);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Event updated");
    } else {
      const slug = slugify(title) + "-" + Math.random().toString(36).slice(2, 6);
      const { error } = await supabase.from("events").insert({ ...payload, host_id: hostId, slug });
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success(status === "published" ? "Event published" : "Draft saved");
    }
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? "Edit event" : "Create event"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required /></div>
          <div className="space-y-1.5"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={4000} /></div>

          <div className="space-y-1.5">
            <Label>Cover image</Label>
            {coverUrl && <img src={coverUrl} alt="" className="mb-2 h-32 w-full rounded object-cover" />}
            <div className="flex gap-2">
              <Input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://… or upload" />
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border/60 px-3 text-sm hover:bg-accent">
                <Upload className="h-4 w-4" />{uploading ? "…" : "Upload"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadCover(e.target.files[0])} />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Starts</Label><Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required /></div>
            <div className="space-y-1.5"><Label>Ends</Label><Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required /></div>
          </div>

          <div className="space-y-1.5">
            <Label>Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-64">
                {timezones.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Location</Label>
            <div className="flex gap-2">
              <Button type="button" variant={mode === "venue" ? "default" : "outline"} size="sm" onClick={() => setMode("venue")}>Venue</Button>
              <Button type="button" variant={mode === "online" ? "default" : "outline"} size="sm" onClick={() => setMode("online")}>Online</Button>
            </div>
            {mode === "venue"
              ? <Input value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} placeholder="123 Main St, City" maxLength={300} />
              : <Input value={onlineUrl} onChange={(e) => setOnlineUrl(e.target.value)} placeholder="https://meet.…" type="url" maxLength={500} />}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Capacity</Label><Input type="number" min={1} max={100000} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} required /></div>
            <div className="space-y-1.5">
              <Label>Visibility</Label>
              <Select value={visibility} onValueChange={(v) => setVisibility(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="unlisted">Unlisted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Pricing</Label>
            <div className="flex gap-2">
              <Button type="button" variant={!isPaid ? "default" : "outline"} size="sm" onClick={() => setIsPaid(false)}>Free</Button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex cursor-default">
                      <Button type="button" variant={isPaid ? "default" : "outline"} size="sm" disabled onClick={() => {}}>Paid</Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Coming soon</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || uploading}>{isEdit ? "Save" : "Create"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MembersPanel({ hostId }: { hostId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"checker" | "host">("checker");

  const { data: members } = useQuery({
    queryKey: ["members", hostId],
    queryFn: async () => {
      const { data, error } = await supabase.from("host_members")
        .select("id, role, user_id, created_at")
        .eq("host_id", hostId);
      if (error) { console.error("members fetch failed", error); return []; }
      const rows = (data as any[]) ?? [];
      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      let profMap = new Map<string, { full_name: string | null; email: string | null }>();
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
        profMap = new Map((profs ?? []).map((p: any) => [p.id, { full_name: p.full_name, email: p.email }]));
      }
      return rows.map((r) => ({ ...r, profile: profMap.get(r.user_id) ?? { full_name: null, email: null } }));
    },
  });

  const { data: invites } = useQuery({
    queryKey: ["invites", hostId],
    queryFn: async () => {
      const { data } = await supabase.from("host_invites")
        .select("id, email, role, token, status, expires_at, created_at")
        .eq("host_id", hostId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      return (data as any[]) ?? [];
    },
  });

  async function createInvite() {
    if (!email.trim() || !user) return;
    const { error } = await supabase.from("host_invites").insert({
      host_id: hostId, email: email.trim().toLowerCase(), role, invited_by: user.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Invite created");
    setEmail("");
    qc.invalidateQueries({ queryKey: ["invites", hostId] });
  }

  async function revoke(id: string) {
    const { error } = await supabase.from("host_invites").update({ status: "revoked" }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["invites", hostId] });
  }

  async function removeMember(id: string) {
    const { error } = await supabase.from("host_members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["members", hostId] });
  }

  function inviteUrl(token: string) {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/invite/${token}`;
  }

  async function copyLink(token: string) {
    await navigator.clipboard.writeText(inviteUrl(token));
    toast.success("Invite link copied");
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h3 className="text-sm font-semibold">Invite a team member</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <Input className="min-w-[200px] flex-1" placeholder="invitee@example.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Select value={role} onValueChange={(v) => setRole(v as any)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="checker">Checker</SelectItem>
              <SelectItem value="host">Host</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={createInvite}><UserPlus className="mr-1 h-4 w-4" />Create invite</Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Invitee must sign in with the same email to accept.</p>
        {invites?.length ? (
          <div className="mt-4 space-y-2">
            {invites.map((inv) => (
              <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 p-3 text-sm">
                <div>
                  <div className="font-medium">{inv.email}</div>
                  <div className="text-xs text-muted-foreground">{inv.role} · {inv.status}</div>
                </div>
                <div className="flex items-center gap-2">
                  {inv.status === "pending" && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => copyLink(inv.token)}><Copy className="mr-1 h-3.5 w-3.5" />Copy link</Button>
                      <Button variant="ghost" size="sm" onClick={() => revoke(inv.id)}>Revoke</Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold">Team members</h3>
        <div className="mt-3 space-y-2">
          {members?.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-md border border-border/60 p-3 text-sm">
              <div><span className="font-medium">{m.profile?.full_name ?? m.profile?.email}</span><span className="ml-2 text-muted-foreground">{m.profile?.email}</span></div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{m.role}</Badge>
                <Badge variant="secondary">Active</Badge>
                {m.user_id !== user?.id && <Button variant="ghost" size="sm" onClick={() => removeMember(m.id)}>Remove</Button>}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
