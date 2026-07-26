import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { CheckCircle2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/pay/$code/success")({
  validateSearch: z.object({ p: z.string().optional(), pending: z.coerce.number().optional() }),
  head: () => ({ meta: [
    { title: "Payment received · Joshi Web Experts" },
    { name: "robots", content: "noindex, nofollow" },
  ]}),
  component: Success,
});

function Success() {
  const { code } = Route.useParams();
  const { p, pending } = Route.useSearch();

  return (
    <div className="relative min-h-screen bg-background bg-hero-glow print:bg-white print:text-black">
      <div className="mx-auto max-w-lg px-4 py-14 print:py-4">
        <div className="glass rounded-3xl p-8 text-center shadow-card print:shadow-none print:border print:bg-white">
          <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
          <h1 className="mt-4 text-3xl font-bold">{pending ? "Received — confirming" : "Payment received"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {pending ? "We've received your payment and are confirming it with our bank. You'll get a final receipt shortly." : "Thank you. A receipt has been generated below."}
          </p>
          <dl className="mt-8 space-y-3 text-left text-sm">
            <Row label="Reference" value={code} />
            {p && <Row label="Payment ID" value={p} mono />}
            <Row label="Date" value={new Date().toLocaleString()} />
            <Row label="Support" value="pratham.work3115@gmail.com" />
          </dl>
          <div className="mt-8 flex justify-center gap-2 print:hidden">
            <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" /> Print / Save PDF</Button>
            <Button asChild className="bg-brand-gradient text-primary-foreground"><Link to="/">Done</Link></Button>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground print:hidden">Joshi Web Experts · Secure payments via Razorpay</p>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono text-xs" : ""}>{value}</dd>
    </div>
  );
}
