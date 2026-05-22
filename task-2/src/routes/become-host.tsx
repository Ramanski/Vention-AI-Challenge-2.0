import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/become-host")({
  component: () => <RequireAuth><BecomeHost /></RequireAuth>,
  head: () => ({ meta: [{ title: "Become a host — Convene" }] }),
});

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

function BecomeHost() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 80) return toast.error("Name required (max 80 chars)");
    if (bio.length > 500) return toast.error("Bio too long (max 500 chars)");
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) return toast.error("Invalid contact email");
    if (logoFile && logoFile.size > 2 * 1024 * 1024) return toast.error("Logo must be under 2MB");

    setLoading(true);
    try {
      const slug = slugify(trimmedName) + "-" + Math.random().toString(36).slice(2, 6);

      let logo_url: string | null = null;
      if (logoFile) {
        const ext = logoFile.name.split(".").pop() || "png";
        const path = `${user.id}/${slug}.${ext}`;
        const { error: upErr } = await supabase.storage.from("host-logos").upload(path, logoFile, { upsert: true });
        if (upErr) throw upErr;
        logo_url = supabase.storage.from("host-logos").getPublicUrl(path).data.publicUrl;
      }

      const { data: host, error } = await supabase.from("hosts").insert({
        owner_id: user.id,
        name: trimmedName,
        slug,
        bio: bio.trim() || null,
        contact_email: contactEmail.trim() || null,
        logo_url,
      }).select().single();
      if (error) throw error;

      const { error: mErr } = await supabase.from("host_members").insert({ host_id: host.id, user_id: user.id, role: "host" });
      if (mErr) throw mErr;

      toast.success("Host created!");
      navigate({ to: "/hosts/$slug", params: { slug } });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create host");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Become a host</h1>
      <p className="mt-1 text-sm text-muted-foreground">Create a host profile to start publishing events.</p>
      <Card className="mt-6 p-6">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Host name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="logo">Logo</Label>
            <Input id="logo" type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} />
            <p className="text-xs text-muted-foreground">Square image, under 2MB.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">Short bio</Label>
            <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={4} maxLength={500} placeholder="Tell people about your community…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Contact email</Label>
            <Input id="email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="hello@example.com" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>{loading ? "Creating…" : "Create host"}</Button>
        </form>
      </Card>
    </div>
  );
}
