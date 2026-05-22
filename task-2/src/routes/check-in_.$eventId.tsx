import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/RequireAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, AlertCircle, Camera, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Html5Qrcode } from "html5-qrcode";

export const Route = createFileRoute("/check-in_/$eventId")({
  component: () => <RequireAuth><CheckInPage /></RequireAuth>,
  head: () => ({ meta: [{ title: "Check-in — Convene" }] }),
});

type LastResult = { ok: boolean; reason?: string; attendee?: string; checkinId?: string };

function CheckInPage() {
  const { eventId } = Route.useParams();
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [last, setLast] = useState<LastResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const { data: event } = useQuery({
    queryKey: ["event-min", eventId],
    queryFn: async () => {
      const { data } = await supabase.from("events").select("title, slug, capacity").eq("id", eventId).maybeSingle();
      return data;
    },
  });

  const { data: counts, refetch: refetchCounts } = useQuery({
    queryKey: ["checkin-counts", eventId],
    queryFn: async () => {
      const [g, w, c] = await Promise.all([
        supabase.from("rsvps").select("id", { count: "exact", head: true }).eq("event_id", eventId).eq("status", "confirmed"),
        supabase.from("rsvps").select("id", { count: "exact", head: true }).eq("event_id", eventId).eq("status", "waitlisted"),
        supabase.from("checkins").select("id", { count: "exact", head: true }).eq("event_id", eventId).is("undone_at", null),
      ]);
      return { going: g.count ?? 0, waitlist: w.count ?? 0, checkedIn: c.count ?? 0 };
    },
    refetchInterval: 10000,
  });

  async function findRecentCheckinId(): Promise<string | null> {
    const { data } = await supabase
      .from("checkins")
      .select("id")
      .eq("event_id", eventId)
      .is("undone_at", null)
      .order("checked_in_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.id ?? null;
  }

  async function submitCode(c: string) {
    if (!c.trim()) return;
    const { data, error } = await supabase.rpc("checkin_by_code", { _event_id: eventId, _code: c.trim() });
    if (error) { toast.error(error.message); return; }
    const r = data as any;
    if (r.ok) {
      const checkinId = await findRecentCheckinId();
      setLast({ ok: true, attendee: r.attendee, checkinId: checkinId ?? undefined });
      toast.success(`Checked in: ${r.attendee ?? "attendee"}`);
    } else if (r.reason === "duplicate") {
      setLast({ ok: false, reason: "duplicate", attendee: r.attendee });
      toast.warning(`Already checked in${r.attendee ? `: ${r.attendee}` : ""}`);
    } else {
      setLast({ ok: false, reason: "invalid" });
      toast.error("Invalid code");
    }
    setCode("");
    refetchCounts();
    qc.invalidateQueries({ queryKey: ["event-counts-row", eventId] });
  }

  async function undoLast() {
    if (!last?.checkinId) return;
    const { error } = await supabase.rpc("undo_checkin", { _checkin_id: last.checkinId });
    if (error) return toast.error(error.message);
    toast.success("Check-in undone");
    setLast(null);
    refetchCounts();
    qc.invalidateQueries({ queryKey: ["event-counts-row", eventId] });
  }

  async function startScan() {
    setScanning(true);
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode("qr-reader");
        scannerRef.current = scanner;
        await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (decoded) => {
          submitCode(decoded);
          scanner.pause(true);
          setTimeout(() => scanner.resume(), 1500);
        }, () => {});
      } catch (e: any) {
        toast.error(e.message ?? "Camera unavailable");
        setScanning(false);
      }
    }, 100);
  }

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {}).finally(() => scannerRef.current?.clear());
      }
    };
  }, []);

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Link to="/check-in" className="text-sm text-muted-foreground hover:text-foreground">← All events</Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Check-in</h1>
      {event && <p className="text-sm text-muted-foreground">{event.title}</p>}

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Card className="p-3 text-center">
          <div className="text-2xl font-semibold">{counts?.going ?? 0}</div>
          <div className="text-xs text-muted-foreground">Going</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-2xl font-semibold">{counts?.waitlist ?? 0}</div>
          <div className="text-xs text-muted-foreground">Waitlist</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-2xl font-semibold">{counts?.checkedIn ?? 0}</div>
          <div className="text-xs text-muted-foreground">Checked in</div>
        </Card>
      </div>

      <Card className="mt-4 p-5">
        <form onSubmit={(e) => { e.preventDefault(); submitCode(code); }} className="flex gap-2">
          <Input placeholder="Enter code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="font-mono uppercase tracking-wider" />
          <Button type="submit">Check in</Button>
        </form>
        <div className="mt-4">
          {!scanning ? (
            <Button variant="outline" className="w-full" onClick={startScan}><Camera className="mr-2 h-4 w-4" />Scan QR</Button>
          ) : (
            <div id="qr-reader" className="overflow-hidden rounded-lg" />
          )}
        </div>
        {last && (
          <div className={`mt-4 flex items-start justify-between gap-2 rounded-md p-3 text-sm ${last.ok ? "bg-primary/10 text-foreground" : last.reason === "duplicate" ? "bg-accent/20" : "bg-destructive/10 text-destructive"}`}>
            <div className="flex items-start gap-2">
              {last.ok ? <CheckCircle2 className="h-4 w-4" /> : last.reason === "duplicate" ? <AlertCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              <span>{last.ok ? `Welcome, ${last.attendee ?? "attendee"}!` : last.reason === "duplicate" ? `Already checked in${last.attendee ? `: ${last.attendee}` : ""}` : "Invalid code"}</span>
            </div>
            {last.ok && last.checkinId && (
              <Button variant="ghost" size="sm" onClick={undoLast}><Undo2 className="mr-1 h-3.5 w-3.5" />Undo</Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
