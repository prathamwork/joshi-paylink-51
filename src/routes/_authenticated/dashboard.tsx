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
  head: () => ({
    meta: [
      { title: "Dashboard — Joshi Web Experts Payments" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const getStats = useServerFn(getDashboardStats);
  const { data, isLoading } = useQuery({ queryKey: ["dash"], queryFn: () => getStats() });

  return (
    <AdminShell title="Overview">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          icon={<TrendingUp className="h-4 w-4" />}
          label="Collected"
          value={money(data?.collectedByCurrency)}
          loading={isLoading}
        />
        <Stat
          icon={<HandCoins className="h-4 w-4" />}
          label="Tips received"
          value={money(data?.tipsByCurrency)}
          loading={isLoading}
        />
        <Stat
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Paid requests"
          value={data?.paidCount ?? "—"}
          loading={isLoading}
        />
        <Stat
          icon={<Clock className="h-4 w-4" />}
          label="Pending links"
          value={data?.pendingCount ?? "—"}
          loading={isLoading}
        />
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recent Cashfree payments</h2>
        <Link to="/links" className="inline-flex items-center gap-1 text-sm text-primary">
          All links <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <Card className="glass mt-3 overflow-hidden">
        {(data?.recentPayments ?? []).length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No payments yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
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
                {data!.recentPayments.map((payment: any) => (
                  <tr key={payment.id} className="border-t border-border">
                    <td className="p-3">{payment.link_client}</td>
                    <td className="p-3 text-muted-foreground">{payment.link_project}</td>
                    <td className="p-3 font-medium">
                      {isCurrency(payment.currency)
                        ? formatMoney(Number(payment.total_amount_minor), payment.currency)
                        : "—"}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {isCurrency(payment.currency)
                        ? formatMoney(Number(payment.tip_amount_minor), payment.currency)
                        : "—"}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {new Date(payment.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="glass mt-8 rounded-2xl p-5">
        <Badge variant="secondary" className="mb-2">Cashfree setup checklist</Badge>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li>• Add <code>CASHFREE_CLIENT_ID</code>, <code>CASHFREE_CLIENT_SECRET</code>, <code>CASHFREE_ENV</code> and <code>APP_BASE_URL</code> in your deployment secrets.</li>
          <li>• Configure the signed webhook URL in the Cashfree dashboard (see <Link to="/setup" className="underline">Setup</Link>).</li>
          <li>• Ask Cashfree to activate International Payment Gateway and the currencies you need, including SBD.</li>
          <li>• Test every currency in sandbox before switching <code>CASHFREE_ENV</code> to <code>production</code>.</li>
        </ul>
      </div>
    </AdminShell>
  );
}

function Stat({
  icon,
  label,
  value,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <Card className="glass p-5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>{icon}
      </div>
      <div className="mt-3 text-2xl font-semibold">{loading ? "…" : value}</div>
    </Card>
  );
}

function money(byCurrency?: Record<string, number>) {
  if (!byCurrency) return "—";
  const entries = Object.entries(byCurrency);
  if (entries.length === 0) return "—";
  return entries
    .map(([currency, minor]) => (isCurrency(currency) ? formatMoney(minor, currency) : `${minor} ${currency}`))
    .join(" · ");
}
