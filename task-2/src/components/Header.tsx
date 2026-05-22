import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth, useHostMemberships } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CalendarDays, Ticket, LayoutDashboard, ScanLine, LogOut, Sparkles } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function Header() {
  const { user } = useAuth();
  const { memberships } = useHostMemberships(user?.id);
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const isHostOwner = memberships.some((m) => m.role === "host");
  const isChecker = memberships.length > 0;

  const initials = (user?.user_metadata?.full_name || user?.email || "?")
    .split(/[\s@]/)[0]
    .slice(0, 2)
    .toUpperCase();

  const linkCls = (active: boolean) =>
    `text-sm transition-colors ${active ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <Sparkles className="h-5 w-5 text-primary" />
          <span>Convene</span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          <Link to="/events" className={linkCls(path.startsWith("/events"))}>Explore</Link>
          {user && <Link to="/tickets" className={linkCls(path.startsWith("/tickets"))}>My tickets</Link>}
          {user && <Link to="/my-events" className={linkCls(path.startsWith("/my-events"))}>My events</Link>}
          {isHostOwner && <Link to="/host" className={linkCls(path.startsWith("/host"))}>Host dashboard</Link>}
          {isChecker && !isHostOwner && <Link to="/check-in" className={linkCls(path.startsWith("/check-in"))}>Check-in</Link>}
        </nav>
        <div className="flex items-center gap-2">
          {!user ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/login", search: { redirect: path } })}>Sign in</Button>
              <Button size="sm" onClick={() => navigate({ to: "/signup", search: { redirect: path } })}>Sign up</Button>
            </>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Avatar className="h-7 w-7"><AvatarFallback>{initials}</AvatarFallback></Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <div className="px-2 py-1.5">
                  <div className="truncate text-sm font-medium">
                    {user.user_metadata?.full_name || user.email}
                  </div>
                  {user.user_metadata?.full_name && user.email && (
                    <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                  )}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/events" })}>
                  <CalendarDays className="mr-2 h-4 w-4" /> Explore events
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/tickets" })}>
                  <Ticket className="mr-2 h-4 w-4" /> My tickets
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/my-events" })}>
                  <CalendarDays className="mr-2 h-4 w-4" /> My events
                </DropdownMenuItem>
                {isHostOwner ? (
                  <DropdownMenuItem onClick={() => navigate({ to: "/host" })}>
                    <LayoutDashboard className="mr-2 h-4 w-4" /> Host dashboard
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => navigate({ to: "/become-host" })}>
                    <Sparkles className="mr-2 h-4 w-4" /> Become a host
                  </DropdownMenuItem>
                )}
                {isChecker && (
                  <DropdownMenuItem onClick={() => navigate({ to: "/check-in" })}>
                    <ScanLine className="mr-2 h-4 w-4" /> Check-in
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await supabase.auth.signOut();
                    navigate({ to: "/" });
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
