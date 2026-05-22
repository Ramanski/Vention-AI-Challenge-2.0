import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !user) {
      const redirect =
        typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
      navigate({ to: "/login", search: { redirect } });
    }
  }, [user, loading, navigate]);
  if (loading || !user)
    return <div className="mx-auto max-w-4xl px-4 py-12 text-sm text-muted-foreground">Loading…</div>;
  return <>{children}</>;
}
