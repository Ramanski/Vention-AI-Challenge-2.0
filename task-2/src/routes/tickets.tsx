import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { RequireAuth } from "@/components/RequireAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import { fmtEventDate } from "@/lib/format";
import { downloadIcs } from "@/lib/ics";

export const Route = createFileRoute("/tickets")({
  component: () => <RequireAuth><TicketsPage /></RequireAuth>,
  head: () => ({ meta: [{ title: "My tickets — Convene" }] }),
});

function TicketsPage() {
  const { user } = useAuth();
  const { data: tickets } = useQuery({
    enabled: !!user,
    queryKey: ["tickets", user?.id],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("tickets")
        .select("id, code, revoked, event:events(id, slug, title, description, starts_at, ends_at, location, venue_address, online_url, cover_url)")
        .eq("user_id", user!.id)
        .eq("revoked", false)
        .gte("event.ends_at", now)
        .order("issued_at", { ascending: false });
      return ((data as any[]) ?? []).filter((t) => t.event);
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">My tickets</h1>
      <p className="mt-1 text-sm text-muted-foreground">Show the QR or code at check-in.</p>
      <div className="mt-8 space-y-4">
        {tickets?.length ? tickets.map((t) => {
          const where = t.event.online_url || t.event.venue_address || t.event.location || "";
          return (
            <Card key={t.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
              <div className="flex-1">
                <Link to="/events/$slug" params={{ slug: t.event.slug }} className="text-lg font-semibold hover:underline">{t.event.title}</Link>
                <div className="mt-1 text-sm text-muted-foreground">{fmtEventDate(t.event.starts_at)}{where ? ` · ${where}` : ""}</div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">Confirmed</Badge>
                  <code className="rounded bg-muted px-2 py-1 font-mono text-sm tracking-wider">{t.code}</code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadIcs({
                      uid: t.id,
                      title: t.event.title,
                      description: t.event.description ?? undefined,
                      location: where || undefined,
                      starts_at: t.event.starts_at,
                      ends_at: t.event.ends_at,
                    })}
                  >
                    <Calendar className="mr-1.5 h-3.5 w-3.5" /> Add to Calendar
                  </Button>
                </div>
              </div>
              <div className="rounded-lg bg-white p-2"><QRCodeSVG value={t.code} size={120} /></div>
            </Card>
          );
        }) : <p className="text-sm text-muted-foreground">No upcoming tickets. <Link to="/events" className="underline">Browse events</Link></p>}
      </div>
    </div>
  );
}
