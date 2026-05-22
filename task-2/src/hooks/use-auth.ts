import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type HostMembership = { host_id: string; role: "host" | "checker"; host: { name: string; slug: string } };

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, user, loading };
}

export function useHostMemberships(userId: string | undefined) {
  const [memberships, setMemberships] = useState<HostMembership[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setMemberships([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("host_members")
      .select("host_id, role, host:hosts(name, slug)")
      .eq("user_id", userId)
      .then(({ data }) => {
        setMemberships((data as any) ?? []);
        setLoading(false);
      });
  }, [userId]);

  return { memberships, loading };
}
