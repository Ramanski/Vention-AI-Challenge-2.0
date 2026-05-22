function fmt(dt: string) {
  return new Date(dt).toISOString().replace(/[-:]|\.\d{3}/g, "");
}

export function downloadIcs(opts: { title: string; description?: string; location?: string; starts_at: string; ends_at: string; uid: string; }) {
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Convene//EN",
    "BEGIN:VEVENT",
    `UID:${opts.uid}@convene`,
    `DTSTAMP:${fmt(new Date().toISOString())}`,
    `DTSTART:${fmt(opts.starts_at)}`,
    `DTEND:${fmt(opts.ends_at)}`,
    `SUMMARY:${escapeText(opts.title)}`,
    opts.description ? `DESCRIPTION:${escapeText(opts.description)}` : "",
    opts.location ? `LOCATION:${escapeText(opts.location)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${opts.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeText(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}
