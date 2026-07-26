import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { CheckCircle2, Clock3, Printer, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { formatMoney, isCurrency } from "@/lib/currency";

export const Route = createFileRoute("/pay/$code/success")({
  validateSearch: z.object({ order_id: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Payment status · Joshi Web Experts" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Success,
});

type Receipt = {
  state: "paid" | "pending" | "failed";
  orderId: string;
  paymentId: string | null;
  baseMinor: number;
  tipMinor: number;
  totalMinor: number;
  currency: string;
  updatedAt: string;
  clientName: string;
  projectTitle: string;
  invoiceRef: string | null;
};

function Success() {
  const { code } = Route.useParams();
  const { order_id: orderId } = Route.useSearch();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [supportEmail, setSupportEmail] = useState("pratham.work3115@gmail.com");

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    fetch(`/api/public/pay/${code}`)
      .then((response) => response.ok ? response.json() : null)
      .then((data: { support_email?: string } | null) => {
        if (!cancelled && data?.support_email) setSupportEmail(data.support_email);
      })
      .catch(() => undefined);

    async function verify(attemptNumber = 0) {
      if (!orderId) {
        if (!cancelled) {
          setLoading(false);
          setMessage("The payment reference is missing. Please contact support before retrying payment.");
        }
        return;
      }

      try {
        const response = await fetch(`/api/public/pay/${code}/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_id: orderId }),
        });
        const data = (await response.json()) as Receipt & { error?: string };
        if (cancelled) return;

        if (data.state) {
          setReceipt(data);
          setLoading(false);
          if (data.state === "pending" && attemptNumber < 5) {
            timer = setTimeout(() => verify(attemptNumber + 1), 2000);
          }
          return;
        }

        setLoading(false);
        setMessage(data.error ?? "We could not verify this payment yet.");
      } catch {
        if (cancelled) return;
        if (attemptNumber < 3) {
          timer = setTimeout(() => verify(attemptNumber + 1), 2000);
        } else {
          setLoading(false);
          setMessage("Network error while verifying payment. Your card will not be charged again by refreshing this page.");
        }
      }
    }

    verify();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [code, orderId]);

  const paid = receipt?.state === "paid";
  const failed = receipt?.state === "failed";
  const pending = receipt?.state === "pending" || loading;
  const currency = receipt && isCurrency(receipt.currency) ? receipt.currency : null;

  return (
    <div className="relative min-h-screen bg-background bg-hero-glow print:bg-white print:text-black">
      <div className="mx-auto max-w-lg px-4 py-14 print:py-4">
        <div className="glass rounded-3xl p-8 text-center shadow-card print:border print:bg-white print:shadow-none">
          {paid ? (
            <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
          ) : failed ? (
            <XCircle className="mx-auto h-14 w-14 text-destructive" />
          ) : (
            <Clock3 className="mx-auto h-14 w-14 text-primary" />
          )}

          <h1 className="mt-4 text-3xl font-bold">
            {paid ? "Payment confirmed" : failed ? "Payment not completed" : "Confirming payment"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {paid
              ? "Thank you. Cashfree has confirmed your payment and your receipt is ready."
              : failed
                ? "This checkout did not complete successfully. No new payment is started from this page."
                : "We are checking the order directly with Cashfree. This normally takes only a few seconds."}
          </p>

          {message && <p className="mt-4 rounded-lg border border-border p-3 text-sm text-muted-foreground">{message}</p>}

          {receipt && (
            <dl className="mt-8 space-y-3 text-left text-sm">
              <Row label="Client" value={receipt.clientName} />
              <Row label="Project" value={receipt.projectTitle} />
              {receipt.invoiceRef && <Row label="Invoice" value={receipt.invoiceRef} />}
              {currency && <Row label="Base" value={formatMoney(receipt.baseMinor, currency)} />}
              {currency && <Row label="Tip" value={formatMoney(receipt.tipMinor, currency)} />}
              {currency && <Row label="Total" value={formatMoney(receipt.totalMinor, currency)} strong />}
              <Row label="Order ID" value={receipt.orderId} mono />
              {receipt.paymentId && <Row label="Payment ID" value={receipt.paymentId} mono />}
              <Row label="Updated" value={new Date(receipt.updatedAt).toLocaleString()} />
              <Row label="Support" value={supportEmail} />
            </dl>
          )}

          <div className="mt-8 flex justify-center gap-2 print:hidden">
            {paid && (
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
              </Button>
            )}
            <Button asChild className="bg-brand-gradient text-primary-foreground">
              <Link to="/">Done</Link>
            </Button>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground print:hidden">
          Joshi Web Experts · Secure checkout powered by Cashfree Payments
        </p>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  strong,
}: {
  label: string;
  value: string;
  mono?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`${mono ? "max-w-[65%] break-all font-mono text-xs" : "text-right"} ${strong ? "font-semibold" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
