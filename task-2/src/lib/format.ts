export function fmtEventDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function fmtDateOnly(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function isPast(iso: string) {
  return new Date(iso).getTime() < Date.now();
}

export function timeUntil(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms < 0) return "Started";
  const d = Math.floor(ms / 86_400_000);
  if (d > 0) return `in ${d}d`;
  const h = Math.floor(ms / 3_600_000);
  if (h > 0) return `in ${h}h`;
  const m = Math.floor(ms / 60_000);
  return `in ${m}m`;
}
