import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EventCard } from "@/components/EventCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSocialMeta } from "@/hooks/use-social-meta";

export const Route = createFileRoute("/hosts/$slug")({
  component: HostPage,
  head: ({ params }) => ({
    meta: [{ title: `Host — Convene` }, { name: "description", content: `Events from ${params.slug}.` }],
  }),
});

function HostPage() {
  const { slug } = Route.useParams();
  const { data: host } = useQuery({
    queryKey: ["host", slug],
    queryFn: async () => {
      const { data } = await supabase.from("hosts").select("*").eq("slug", slug).maybeSingle();
      return data as any;
    },
  });
  const { data: events } = useQuery({
    enabled: !!host?.id,
    queryKey: ["host-events", host?.id],
    queryFn: async () => {
      const { data } = await supabase.from("events")
        .select("id, slug, title, cover_url, starts_at, ends_at, location, capacity")
        .eq("host_id", host!.id).eq("status", "published").eq("visibility", "public").order("starts_at", { ascending: false });
      return (data as any[]) ?? [];
    },
  });

  useSocialMeta({
    title: host ? `${host.name} — Convene` : null,
    description: host?.bio ?? null,
    image: host?.logo_url ?? null,
    type: "website",
  });

  if (!host) return <div className="mx-auto max-w-4xl px-4 py-12">Host not found.</div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          {host.logo_url && <AvatarImage src={host.logo_url} />}
          <AvatarFallback>{host.name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{host.name}</h1>
          {host.bio && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{host.bio}</p>}
          {host.contact_email && (
            <p className="mt-2 text-sm">
              <a href={`mailto:${host.contact_email}`} className="text-primary hover:underline">{host.contact_email}</a>
            </p>
          )}
        </div>
      </div>
      <h2 className="mt-12 mb-4 text-lg font-semibold">Events</h2>
      {events?.length ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => <EventCard key={e.id} event={{ ...e, host: { name: host.name, slug: host.slug } }} />)}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No events yet. <Link to="/events" className="underline">Browse all</Link></p>
      )}
    </div>
  );
}
