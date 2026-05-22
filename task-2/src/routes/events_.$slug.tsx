import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar, MapPin, Users, Flag, Upload, Star } from "lucide-react";
import { fmtEventDate, isPast } from "@/lib/format";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { GalleryLightbox } from "@/components/GalleryLightbox";
import { useSocialMeta } from "@/hooks/use-social-meta";

export const Route = createFileRoute("/events_/$slug")({
  component: EventDetail,
  head: ({ params }) => ({
    meta: [
      { title: `Event — Convene` },
      { name: "description", content: `RSVP and details for ${params.slug}.` },
    ],
  }),
});

function EventDetail() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [reportTarget, setReportTarget] = useState<{ type: "event" | "photo"; id: string } | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [uploading, setUploading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const { data: event, isLoading } = useQuery({
    queryKey: ["event", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*, host:hosts(id, name, slug, logo_url)")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: counts } = useQuery({
    enabled: !!event?.id,
    queryKey: ["event-counts", event?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_event_counts", { _event_id: event!.id });
      if (error) {
        console.error("get_event_counts failed", error);
        return { confirmed: 0, waitlisted: 0 };
      }
      const row = Array.isArray(data) ? data[0] : data;
      return {
        confirmed: Number(row?.going_count ?? 0),
        waitlisted: Number(row?.waitlist_count ?? 0),
      };
    },
  });

  const { data: myRsvp } = useQuery({
    enabled: !!event?.id && !!user,
    queryKey: ["my-rsvp", event?.id, user?.id],
    queryFn: async () => {
      const { data: rsvp } = await supabase
        .from("rsvps").select("status, position, created_at")
        .eq("event_id", event!.id).eq("user_id", user!.id).maybeSingle();
      if (!rsvp) return null;
      const { data: ticket } = await supabase
        .from("tickets").select("issued_at")
        .eq("event_id", event!.id).eq("user_id", user!.id).eq("revoked", false).maybeSingle();
      const promoted = !!(rsvp.status === "confirmed" && ticket && new Date(ticket.issued_at).getTime() - new Date(rsvp.created_at).getTime() > 5000);
      return { ...rsvp, promoted } as any;
    },
  });

  const { data: photos } = useQuery({
    enabled: !!event?.id,
    queryKey: ["gallery", event?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("gallery_photos").select("id, storage_path, status, uploader_id")
        .eq("event_id", event!.id).eq("status", "approved")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: feedback } = useQuery({
    enabled: !!event?.id,
    queryKey: ["feedback", event?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feedback").select("id, rating, comment, user_id, created_at")
        .eq("event_id", event!.id)
        .order("created_at", { ascending: false });
      if (error) { console.error("feedback fetch failed", error); return []; }
      const rows = (data as any[]) ?? [];
      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      let nameMap = new Map<string, string>();
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        nameMap = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
      }
      return rows.map((r) => ({ ...r, profile: { full_name: nameMap.get(r.user_id) ?? null } }));
    },
  });

  const myFeedback = user ? feedback?.find((f) => f.user_id === user.id) : null;

  useSocialMeta({
    title: event ? `${event.title} — Convene` : null,
    description: event?.description ?? null,
    image: event?.cover_url ?? null,
    type: "website",
  });

  if (isLoading) return <div className="mx-auto max-w-4xl px-4 py-12 text-sm text-muted-foreground">Loading…</div>;
  if (!event) return <div className="mx-auto max-w-4xl px-4 py-12">Event not found.</div>;

  const past = isPast(event.ends_at);
  const full = (counts?.confirmed ?? 0) >= event.capacity;
  const seatsLeft = Math.max(0, event.capacity - (counts?.confirmed ?? 0));

  async function handleRsvp() {
    if (!user) {
      navigate({ to: "/login", search: { redirect: `/events/${slug}` } });
      return;
    }
    const { data, error } = await supabase.rpc("rsvp_to_event", { _event_id: event.id });
    if (error) return toast.error(error.message);
    const r = data as any;
    if (r.status === "confirmed") toast.success(r.already ? "You're already in!" : "You're in! Ticket issued.");
    else if (r.status === "waitlisted") toast.message(`Added to waitlist (#${r.position})`);
    qc.invalidateQueries({ queryKey: ["event-counts", event.id] });
    qc.invalidateQueries({ queryKey: ["my-rsvp", event.id, user.id] });
  }

  async function handleCancel() {
    const { error } = await supabase.rpc("cancel_rsvp", { _event_id: event.id });
    if (error) return toast.error(error.message);
    toast.success("RSVP cancelled");
    qc.invalidateQueries({ queryKey: ["event-counts", event.id] });
    qc.invalidateQueries({ queryKey: ["my-rsvp", event.id, user!.id] });
  }

  async function submitReport() {
    if (!user) return navigate({ to: "/login", search: { redirect: `/events/${slug}` } });
    if (!reportTarget) return;
    if (!reportReason.trim()) return toast.error("Add a reason");
    const { error } = await supabase.from("reports").insert({
      target_type: reportTarget.type, target_id: reportTarget.id, event_id: event.id, reporter_id: user.id, reason: reportReason.trim(),
    });
    if (error) return toast.error(error.message);
    toast.success("Report submitted");
    setReportTarget(null);
    setReportReason("");
  }

  async function submitFeedback() {
    if (!user) return navigate({ to: "/login", search: { redirect: `/events/${slug}` } });
    const { error } = await supabase.from("feedback").insert({
      event_id: event.id, user_id: user.id, rating: feedbackRating, comment: feedbackComment.trim() || null,
    });
    if (error) {
      console.error("submitFeedback failed", error);
      if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
        return toast.error("You have already submitted feedback for this event.");
      }
      if (/row-level security/i.test(error.message)) {
        return toast.error("You can only leave feedback after the event ends, and only if you RSVP'd.");
      }
      return toast.error(error.message || "Failed to submit feedback. Please try again.");
    }
    toast.success("Thanks for the feedback!");
    setFeedbackComment("");
    qc.invalidateQueries({ queryKey: ["feedback", event.id] });
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const path = `${event.id}/${user.id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("gallery").upload(path, file);
    if (upErr) { setUploading(false); return toast.error(upErr.message); }
    const { error } = await supabase.from("gallery_photos").insert({
      event_id: event.id, uploader_id: user.id, storage_path: path,
    });
    setUploading(false);
    if (error) return toast.error(error.message);
    toast.success("Photo submitted for review");
  }

  const avgRating = feedback?.length ? (feedback.reduce((s, f) => s + f.rating, 0) / feedback.length).toFixed(1) : null;

  return (
    <div>
      {event.cover_url && (
        <div className="relative h-72 overflow-hidden bg-muted md:h-96">
          <img src={event.cover_url} alt={event.title} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
        </div>
      )}
      <div className="mx-auto -mt-20 max-w-4xl px-4 pb-16">
        <Card className="relative overflow-hidden p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <Link to="/hosts/$slug" params={{ slug: event.host.slug }} className="text-sm text-muted-foreground hover:text-foreground">
                {event.host.name}
              </Link>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">{event.title}</h1>
              <div className="mt-3 flex flex-wrap gap-2">
                {past && <Badge variant="secondary">Ended</Badge>}
                {!past && full && <Badge variant="outline">Waitlist only</Badge>}
                {!past && !full && <Badge>{seatsLeft} seats left</Badge>}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setReportTarget({ type: "event", id: event.id })} aria-label="Report"><Flag className="h-4 w-4" /></Button>
          </div>

          <div className="mt-6 grid gap-3 text-sm md:grid-cols-3">
            <div className="flex items-start gap-2"><Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" /><div>{fmtEventDate(event.starts_at)}<div className="text-xs text-muted-foreground">to {fmtEventDate(event.ends_at)}</div><div className="text-xs text-muted-foreground">{event.timezone}</div></div></div>
            {event.online_url ? (
              <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" /><a href={event.online_url} target="_blank" rel="noreferrer" className="break-all underline-offset-2 hover:underline">{event.online_url}</a></div>
            ) : (event.venue_address || event.location) && (
              <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />{event.venue_address || event.location}</div>
            )}
            <div className="flex items-start gap-2"><Users className="mt-0.5 h-4 w-4 text-muted-foreground" />{counts?.confirmed ?? 0} / {event.capacity} attending {counts?.waitlisted ? `· ${counts.waitlisted} waitlisted` : ""}</div>
          </div>

          {event.description && <p className="mt-6 whitespace-pre-wrap leading-relaxed text-foreground/90">{event.description}</p>}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/30 p-4">
            <div className="flex items-center gap-3">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2"><Switch disabled checked={false} /><span className="text-sm text-muted-foreground">Paid tickets</span></div>
                  </TooltipTrigger>
                  <TooltipContent>Coming soon</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            {past ? (
              <span className="text-sm text-muted-foreground">This event has ended.</span>
            ) : myRsvp && myRsvp.status !== "cancelled" ? (
              <div className="flex items-center gap-3">
                <Badge variant="secondary">{myRsvp.status === "confirmed" ? "You're in" : `Waitlist #${myRsvp.position}`}</Badge>
                {myRsvp.status === "confirmed" && <Button asChild variant="outline" size="sm"><Link to="/tickets">My ticket</Link></Button>}
                <Button variant="ghost" size="sm" onClick={handleCancel}>Cancel RSVP</Button>
              </div>
            ) : (
              <Button onClick={handleRsvp}>{full ? "Join waitlist" : "RSVP"}</Button>
            )}
          </div>
          {myRsvp?.promoted && (
            <div className="mt-4 rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm">
              🎉 You've been promoted from the waitlist! Your ticket is ready in <Link to="/tickets" className="font-medium underline">My tickets</Link>.
            </div>
          )}
        </Card>

        {/* Gallery */}
        <section className="mt-12">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Gallery</h2>
            {myRsvp?.status === "confirmed" && (
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <Upload className="h-4 w-4" /> {uploading ? "Uploading…" : "Upload photo"}
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
              </label>
            )}
          </div>
          {photos && photos.length > 0 ? (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                {photos.map((p, i) => {
                  const url = supabase.storage.from("gallery").getPublicUrl(p.storage_path).data.publicUrl;
                  return (
                    <div key={p.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => setLightboxIndex(i)}
                        className="block w-full overflow-hidden rounded-lg"
                        aria-label="Open photo"
                      >
                        <img src={url} alt="" className="aspect-square w-full rounded-lg object-cover transition-transform group-hover:scale-[1.02]" loading="lazy" />
                      </button>
                      {user && (
                        <button
                          onClick={() => setReportTarget({ type: "photo", id: p.id })}
                          className="absolute right-1 top-1 rounded-full bg-background/80 p-1 opacity-0 backdrop-blur transition-opacity hover:bg-background group-hover:opacity-100"
                          aria-label="Report photo"
                        >
                          <Flag className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <GalleryLightbox
                items={photos.map((p) => ({
                  id: p.id,
                  url: supabase.storage.from("gallery").getPublicUrl(p.storage_path).data.publicUrl,
                }))}
                index={lightboxIndex}
                onIndexChange={setLightboxIndex}
                onClose={() => setLightboxIndex(null)}
              />
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No photos yet.</p>
          )}
        </section>

        {/* Feedback */}
        {past && (
          <section className="mt-12">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Feedback {avgRating && <span className="ml-2 text-sm text-muted-foreground">{avgRating} ★ avg</span>}</h2>
            </div>
            {!user ? (
              <p className="mt-4 text-sm text-muted-foreground">Sign in to leave feedback.</p>
            ) : myFeedback ? (
              <p className="mt-4 text-sm text-muted-foreground">You already submitted feedback for this event.</p>
            ) : myRsvp?.status === "confirmed" ? (
              <Card className="mt-4 p-4">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => setFeedbackRating(n)} aria-label={`${n} stars`}>
                      <Star className={`h-5 w-5 ${n <= feedbackRating ? "fill-accent text-accent" : "text-muted-foreground"}`} />
                    </button>
                  ))}
                </div>
                <Textarea className="mt-3" placeholder="Share your experience…" value={feedbackComment} onChange={(e) => setFeedbackComment(e.target.value)} />
                <div className="mt-3 flex justify-end"><Button size="sm" onClick={submitFeedback}>Submit</Button></div>
              </Card>
            ) : null}
            <div className="mt-4 space-y-3">
              {feedback?.length ? feedback.map((f) => (
                <Card key={f.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{f.profile?.full_name ?? "Attendee"}</span>
                    <div className="flex items-center gap-2">
                      {f.created_at && <span className="text-xs text-muted-foreground">{new Date(f.created_at).toLocaleDateString()}</span>}
                      <div className="flex">{Array.from({ length: f.rating }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-accent text-accent" />)}</div>
                    </div>
                  </div>
                  {f.comment && <p className="mt-2 text-sm text-muted-foreground">{f.comment}</p>}
                </Card>
              )) : <p className="text-sm text-muted-foreground">No feedback yet.</p>}
            </div>
          </section>
        )}
      </div>

      <Dialog open={!!reportTarget} onOpenChange={(o) => !o && setReportTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Report {reportTarget?.type ?? "item"}</DialogTitle></DialogHeader>
          <Textarea value={reportReason} onChange={(e) => setReportReason(e.target.value)} placeholder={`What's wrong with this ${reportTarget?.type ?? "item"}?`} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReportTarget(null)}>Cancel</Button>
            <Button onClick={submitReport}>Submit report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
