import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboardStats } from "@/lib/admin.functions";
import { AdminShell } from "@/components/admin/AdminShell";
import { formatMoney, isCurrency } from "@/lib/currency";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, TrendingUp, HandCoins, CheckCircle2, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [
    { title: "Dashboard — Joshi Web Experts Payments" },
    { name: "robots", content: "noindex, nofollow" },
  ]}),
  component: Dashboard,
});

function Dashboard() {
  const fn = useServerFn(getDashboardStats);
  const { data, isLoading } = useQuery({ queryKey: ["dash"], queryFn: () => fn() });

  return (
    <AdminShell title="Overview">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon={<TrendingUp className="h-4 w-4" />} label="Collected" value={money(data?.collectedByCurrency)} loading={isLoading} />
        <Stat icon={<HandCoins className="h-4 w-4" />} label="Tips received" value={money(data?.tipsByCurrency)} loading={isLoading} />
        <Stat icon={<CheckCircle2 className="h-4 w-4" />} label="Paid requests" value={data?.paidCount ?? "—"} loading={isLoading} />
        <Stat icon={<Clock className="h-4 w-4" />} label="Pending links" value={data?.pendingCount ?? "—"} loading={isLoading} />
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recent payments</h2>
        <Link to="/links" className="text-sm text-primary inline-flex items-center gap-1">All links <ArrowRight className="h-3.5 w-3.5" /></Link>
      </div>
      <Card className="glass mt-3 overflow-hidden">
        {(data?.recentPayments ?? []).length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No payments yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-accent/50 text-left">
              <tr>
                <th className="p-3 font-medium">Client</th>
                <th className="p-3 font-medium">Project</th>
                <th className="p-3 font-medium">Total</th>
                <th className="p-3 font-medium">Tip</th>
                <th className="p-3 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {data!.recentPayments.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-3">{r.link_client}</td>
                  <td className="p-3 text-muted-foreground">{r.link_project}</td>
                  <td className="p-3 font-medium">{isCurrency(r.currency) ? formatMoney(Number(r.total_amount_minor), r.currency) : "—"}</td>
                  <td className="p-3 text-muted-foreground">{isCurrency(r.currency) ? formatMoney(Number(r.tip_amount_minor), r.currency) : "—"}</td>
                  <td className="p-3 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="mt-8 glass rounded-2xl p-5">
        <Badge variant="secondary" className="mb-2">Setup checklist</Badge>
        <ul className="text-sm text-muted-foreground space-y-1.5">
          <li>• Add <code>RAZORPAY_KEY_ID</code>, <code>RAZORPAY_KEY_SECRET</code>, <code>RAZORPAY_WEBHOOK_SECRET</code>, <code>APP_BASE_URL</code> in Project Settings → Secrets.</li>
          <li>• Configure the webhook URL in your Razorpay dashboard (see <Link to="/setup" className="underline">Setup</Link>).</li>
          <li>• International currencies (USD, GBP, EUR, AUD, CAD, NZD, SGD, AED) require Razorpay international payments to be activated on your account.</li>
        </ul>
      </div>
    </AdminShell>
  );
}

function Stat({ icon, label, value, loading }: { icon: React.ReactNode; label: string; value: React.ReactNode; loading?: boolean }) {
  return (
    <Card className="glass p-5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>{icon}
      </div>
      <div className="mt-3 text-2xl font-semibold">{loading ? "…" : value}</div>
    </Card>
  );
}

function money(byCur?: Record<string, number>) {
  if (!byCur) return "—";
  const entries = Object.entries(byCur);
  if (entries.length === 0) return "—";
  return entries.map(([c, m]) => (isCurrency(c) ? formatMoney(m, c) : `${m} ${c}`)).join(" · ");
}
