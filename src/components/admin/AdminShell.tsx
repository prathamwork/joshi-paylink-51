import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMe } from "@/lib/admin.functions";
import { LogOut, LayoutDashboard, Link as LinkIcon, Settings, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";
import { OWNER_EMAIL } from "@/lib/owner";

export function AdminShell({ children, title }: { children: ReactNode; title?: string }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const me = useServerFn(getMe);
  const { data } = useQuery({ queryKey: ["me"], queryFn: () => me() });
  const isOwner = data?.isAdmin && data.email?.toLowerCase() === OWNER_EMAIL;

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    nav({ to: "/auth", replace: true });
  }

  if (data && !isOwner) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-hero-glow px-6">
        <div className="glass max-w-md rounded-3xl p-8 text-center">
          <h1 className="text-xl font-semibold">Access denied</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Only the owner account may access this console.
          </p>
          <Button onClick={signOut} className="mt-6">
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-hero-glow">
      <div className="mx-auto flex max-w-7xl">
        <aside className="hidden lg:flex sticky top-0 h-screen w-64 flex-col border-r border-border px-5 py-6">
          <Link to="/dashboard" className="mb-8 flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-brand-gradient shadow-glow" />
            <div>
              <div className="text-sm font-semibold leading-tight">Joshi Web Experts</div>
              <div className="text-xs text-muted-foreground">Payments</div>
            </div>
          </Link>
          <nav className="space-y-1 text-sm">
            <NavItem to="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />}>
              Dashboard
            </NavItem>
            <NavItem to="/links" icon={<LinkIcon className="h-4 w-4" />}>
              Payment links
            </NavItem>
            <NavItem to="/links/new" icon={<Plus className="h-4 w-4" />}>
              New link
            </NavItem>
            <NavItem to="/settings" icon={<Settings className="h-4 w-4" />}>
              Settings
            </NavItem>
          </nav>
          <div className="mt-auto">
            <div className="mb-3 truncate text-xs text-muted-foreground">{data?.email}</div>
            <Button variant="ghost" onClick={signOut} className="w-full justify-start">
              <LogOut className="h-4 w-4 mr-2" /> Sign out
            </Button>
          </div>
        </aside>
        <main className="flex-1 min-w-0 px-5 py-6 lg:px-10 lg:py-10">
          <header className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold lg:text-3xl">{title}</h1>
            <div className="flex items-center gap-2 lg:hidden">
              <Link to="/dashboard" className="text-xs text-muted-foreground">
                Dashboard
              </Link>
              <Link to="/links" className="text-xs text-muted-foreground">
                Links
              </Link>
              <Link to="/settings" className="text-xs text-muted-foreground">
                Settings
              </Link>
              <button onClick={signOut} className="text-xs text-muted-foreground">
                Sign out
              </button>
            </div>
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}

function NavItem({ to, icon, children }: { to: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-muted-foreground hover:bg-accent hover:text-foreground"
      activeProps={{
        className: "flex items-center gap-2 rounded-lg px-3 py-2 bg-accent text-foreground",
      }}
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}
