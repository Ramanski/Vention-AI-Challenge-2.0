import { supabase } from "@/integrations/supabase/client";

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function exportEventRsvpsCsv(
  event: { id: string; slug?: string | null },
  opts: { attendanceOnly?: boolean; fileSuffix?: string } = {},
) {
  const { attendanceOnly = false, fileSuffix = "rsvps" } = opts;

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
    profileById = new Map(
      (profiles ?? []).map((p) => [p.id, { full_name: p.full_name, email: p.email }]),
    );
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
  const source = attendanceOnly
    ? (rsvps ?? []).filter((r) => checkinByUser.has(r.user_id))
    : (rsvps ?? []);
  const rows = source.map((r) => {
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
  a.download = `${event.slug || event.id}-${fileSuffix}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
