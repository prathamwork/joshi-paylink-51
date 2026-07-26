import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLinkDetail } from "@/lib/admin.functions";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney, isCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/links/$id")({
  head: () => ({ meta: [{ title: "Link detail — Joshi Web Experts" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: LinkDetail,
});

function LinkDetail() {
  const { id } = Route.useParams();
  const fn = useServerFn(getLinkDetail);
  const { data, isLoading } = useQuery({ queryKey: ["link", id], queryFn: () => fn({ data: { id } }) });

  if (isLoading || !data) return <AdminShell title="Link detail"><div className="text-sm text-muted-foreground">Loading…</div></AdminShell>;
  const { link, attempts } = data;
  const url = typeof window !== "undefined" ? `${window.location.origin}/pay/${link.public_code}` : "";
  const cur = isCurrency(link.currency) ? link.currency : "INR";

  return (
    <AdminShell title={link.project_title}>
      <Link to="/links" className="text-xs text-muted-foreground">← All links</Link>
      <div className="mt-3 grid gap-5 lg:grid-cols-3">
        <Card className="glass p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">{link.client_name} · {link.client_email ?? "—"}</div>
              {link.invoice_ref && <div className="text-xs text-muted-foreground">Invoice #{link.invoice_ref}</div>}
            </div>
            <Badge variant="outline">{link.status}</Badge>
          </div>
          <div className="mt-4 text-4xl font-bold">{formatMoney(Number(link.base_amount_minor), cur)}</div>
          {link.description && <p className="mt-4 text-sm text-muted-foreground whitespace-pre-line">{link.description}</p>}
          <div className="mt-6 flex items-center gap-2 rounded-lg border border-border bg-background/50 p-3 text-sm">
            <div className="truncate flex-1 font-mono">{url}</div>
            <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(url); toast.success("Copied"); }}><Copy className="h-4 w-4" /></Button>
            <Button size="sm" asChild><a href={`/pay/${link.public_code}`} target="_blank" rel="noreferrer">Open</a></Button>
          </div>
        </Card>

        <Card className="glass p-6">
          <div className="text-sm font-medium mb-3">Attempts</div>
          {attempts.length === 0 ? <div className="text-sm text-muted-foreground">No attempts yet.</div> : (
            <ul className="space-y-3 text-sm">
              {attempts.map((a) => (
                <li key={a.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">{a.status}</span>
                    <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                  </div>
                  <div className="mt-1 font-medium">{isCurrency(a.currency) ? formatMoney(Number(a.total_amount_minor), a.currency) : `${a.total_amount_minor} ${a.currency}`}</div>
                  <div className="text-xs text-muted-foreground">Base {isCurrency(a.currency) ? formatMoney(Number(a.base_amount_minor), a.currency) : a.base_amount_minor} · Tip {isCurrency(a.currency) ? formatMoney(Number(a.tip_amount_minor), a.currency) : a.tip_amount_minor}</div>
                  {a.razorpay_order_id && <div className="mt-1 font-mono text-[10px] text-muted-foreground truncate">order {a.razorpay_order_id}</div>}
                  {a.razorpay_payment_id && <div className="font-mono text-[10px] text-muted-foreground truncate">pay {a.razorpay_payment_id}</div>}
                  {a.error_description && <div className="text-xs text-destructive mt-1">{a.error_description}</div>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AdminShell>
  );
}
