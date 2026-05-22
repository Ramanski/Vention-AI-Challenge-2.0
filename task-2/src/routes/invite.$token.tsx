import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/invite/$token")({
  component: AcceptInvite,
  head: () => ({ meta: [{ title: "Accept invite — Convene" }] }),
});

function AcceptInvite() {
  const { token } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<"idle" | "accepting" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function accept() {
    setState("accepting");
    const { data, error } = await supabase.rpc("accept_host_invite", { _token: token });
    if (error) {
      setState("error");
      setMessage(error.message);
      toast.error(error.message);
      return;
    }
    setState("done");
    setMessage("Invite accepted");
    toast.success("You've joined the team");
    setTimeout(() => navigate({ to: "/host" }), 800);
    return data;
  }

  useEffect(() => {
    if (!loading && user && state === "idle") accept();
  }, [loading, user]);

  if (loading) return <div className="mx-auto max-w-md px-4 py-12 text-sm text-muted-foreground">Loading…</div>;

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <h1 className="text-2xl font-semibold">You're invited</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in with the invited email to accept this invite.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild><Link to="/login" search={{ redirect: `/invite/${token}` }}>Sign in</Link></Button>
          <Button variant="outline" asChild><Link to="/signup" search={{ redirect: `/invite/${token}` }}>Sign up</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Card className="p-6 text-center">
        {state === "accepting" && <p className="text-sm text-muted-foreground">Accepting invite…</p>}
        {state === "done" && <p className="text-sm">{message}. Redirecting…</p>}
        {state === "error" && (
          <>
            <h2 className="text-lg font-semibold">Couldn't accept invite</h2>
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
            <Button className="mt-4" variant="outline" asChild><Link to="/">Go home</Link></Button>
          </>
        )}
      </Card>
    </div>
  );
}
