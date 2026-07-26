import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CURRENCIES, formatMoney, fromMinor, toMinor, type CurrencyCode } from "@/lib/currency";
import type { PublicLinkView } from "@/lib/public-link.server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/pay/$code")({
  head: () => ({
    meta: [
      { title: "Secure payment · Joshi Web Experts" },
      { name: "description", content: "Complete your secure payment for Joshi Web Experts." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Secure payment · Joshi Web Experts" },
      { property: "og:description", content: "A secure payment request from Joshi Web Experts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PayPage,
});

type TipMode = "none" | "preset" | "custom";
declare global { interface Window { Razorpay?: new (opts: unknown) => { open: () => void; on: (ev: string, cb: (r: unknown) => void) => void } } }

function PayPage() {
  const { code } = Route.useParams();
  const nav = useNavigate();
  const [link, setLink] = useState<PublicLinkView | null | undefined>(undefined);
  const [tipMode, setTipMode] = useState<TipMode>("none");
  const [tipPreset, setTipPreset] = useState<number | null>(null);
  const [tipCustom, setTipCustom] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/public/pay/${code}`).then(async (r) => {
      if (r.status === 404) { setLink(null); return; }
      const j = (await r.json()) as PublicLinkView;
      setLink(j);
      if (j.tip_presets?.length) setTipPreset(j.tip_presets[0]);
    }).catch(() => setLink(null));
  }, [code]);

  const currency = link?.currency ?? ("INR" as CurrencyCode);
  const tipMinor = useMemo(() => {
    if (!link || !link.allow_tip || tipMode === "none") return 0;
    if (tipMode === "preset" && tipPreset != null) return Math.round((link.base_amount_minor * tipPreset) / 100);
    if (tipMode === "custom") {
      const n = Number(tipCustom);
      if (!Number.isFinite(n) || n < 0) return 0;
      return toMinor(n, currency);
    }
    return 0;
  }, [link, tipMode, tipPreset, tipCustom, currency]);
  const totalMinor = (link?.base_amount_minor ?? 0) + tipMinor;

  async function pay() {
    if (!link) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/public/pay/${code}/order`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tip_type: tipMode,
          tip_preset_percent: tipMode === "preset" ? tipPreset : undefined,
          tip_custom_minor: tipMode === "custom" ? tipMinor : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Could not start payment"); return; }
      if (!window.Razorpay) { toast.error("Payment library not loaded. Refresh and try again."); return; }
      const rzp = new window.Razorpay({
        key: data.keyId, order_id: data.orderId, amount: data.amount, currency: data.currency,
        name: data.brand, description: data.description,
        theme: { color: "#0b1220" },
        handler: async (resp: unknown) => {
          const r = resp as { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
          const v = await fetch(`/api/public/pay/${code}/verify`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(r),
          });
          const vj = await v.json();
          if (v.ok && vj.ok) {
            nav({ to: "/pay/$code/success", params: { code }, search: { p: r.razorpay_payment_id } });
          } else {
            toast.warning("Payment received — awaiting confirmation. You'll get a receipt shortly.");
            nav({ to: "/pay/$code/success", params: { code }, search: { p: r.razorpay_payment_id, pending: 1 } });
          }
        },
      });
      rzp.on("payment.failed", (resp: unknown) => {
        const r = resp as { error?: { description?: string } };
        toast.error(r.error?.description ?? "Payment failed");
      });
      rzp.open();
    } catch {
      toast.error("Network error. Please try again.");
    } finally { setBusy(false); }
  }

  if (link === undefined) return <Shell><div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></Shell>;
  if (link === null) return <Shell><Empty title="Link not found" body="This payment link doesn't exist or has been removed." /></Shell>;
  if (link.effective_status === "paid") return <Shell><Empty title="Already paid" body="This payment has already been completed. Thank you." /></Shell>;
  if (link.effective_status === "expired") return <Shell><Empty title="Link expired" body="Please contact us for a fresh payment link." /></Shell>;
  if (link.effective_status === "cancelled") return <Shell><Empty title="Link cancelled" body="This payment request was cancelled." /></Shell>;
  if (link.effective_status === "draft") return <Shell><Empty title="Not available" body="This link isn't active yet." /></Shell>;

  return (
    <Shell brand={link.brand_name} tagline={link.brand_tagline}>
      <div className="glass rounded-3xl p-6 sm:p-8 shadow-card">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Payment request</div>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{link.project_title}</h1>
        <div className="mt-1 text-sm text-muted-foreground">For {link.client_name}{link.invoice_ref ? ` · Invoice #${link.invoice_ref}` : ""}</div>
        {link.description && <p className="mt-4 text-sm text-muted-foreground whitespace-pre-line">{link.description}</p>}

        <div className="mt-6 rounded-2xl border border-border bg-background/40 p-5">
          <div className="text-xs text-muted-foreground">Amount due</div>
          <div className="mt-1 text-4xl font-bold tracking-tight">{formatMoney(link.base_amount_minor, currency)}</div>
        </div>

        {link.allow_tip && (
          <div className="mt-6">
            <div className="text-sm font-medium">Add a tip for the team <span className="text-muted-foreground font-normal">(optional)</span></div>
            <div className="mt-3 flex flex-wrap gap-2">
              <TipChip active={tipMode === "none"} onClick={() => { setTipMode("none"); }}>No tip</TipChip>
              {link.tip_presets.map((p) => (
                <TipChip key={p} active={tipMode === "preset" && tipPreset === p} onClick={() => { setTipMode("preset"); setTipPreset(p); }}>
                  {p}% · {formatMoney(Math.round((link.base_amount_minor * p) / 100), currency)}
                </TipChip>
              ))}
              {link.tip_custom_allowed && (
                <TipChip active={tipMode === "custom"} onClick={() => setTipMode("custom")}>Custom</TipChip>
              )}
            </div>
            {tipMode === "custom" && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{CURRENCIES[currency].symbol}</span>
                <Input inputMode="decimal" placeholder="0.00" value={tipCustom} onChange={(e) => setTipCustom(e.target.value)} className="max-w-40" />
              </div>
            )}
          </div>
        )}

        <div className="mt-6 border-t border-border pt-4 space-y-1.5 text-sm">
          <Row label="Base"><span>{formatMoney(link.base_amount_minor, currency)}</span></Row>
          <Row label="Tip"><span>{formatMoney(tipMinor, currency)}</span></Row>
          <Row label={<span className="font-semibold">Total</span>}><span className="font-semibold text-lg">{formatMoney(totalMinor, currency)}</span></Row>
        </div>

        <Button onClick={pay} disabled={busy || totalMinor <= 0} className="mt-6 w-full bg-brand-gradient text-primary-foreground shadow-glow font-semibold text-base py-6">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : `Pay ${formatMoney(totalMinor, currency)} securely`}
        </Button>
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4" /> Payments securely processed by Razorpay.
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children, brand, tagline }: { children: React.ReactNode; brand?: string; tagline?: string }) {
  return (
    <div className="relative min-h-screen bg-background bg-hero-glow overflow-hidden">
      <div className="absolute inset-0 bg-hero-grid opacity-30" />
      <div className="relative mx-auto max-w-lg px-4 pt-10 pb-16 sm:pt-14">
        <div className="mb-6 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-brand-gradient shadow-glow" />
          <div>
            <div className="text-sm font-semibold">{brand ?? "Joshi Web Experts"}</div>
            <div className="text-xs text-muted-foreground">{tagline ?? "Premium web experiences"}</div>
          </div>
        </div>
        {children}
        <div className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">joshiwebexperts.com</Link>
        </div>
      </div>
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="glass rounded-3xl p-8 text-center">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      <Link to="/" className="mt-6 inline-flex rounded-full border border-border px-5 py-2 text-sm">Go home</Link>
    </div>
  );
}

function TipChip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-full border px-3.5 py-1.5 text-sm transition ${active ? "bg-primary text-primary-foreground border-primary shadow-glow" : "border-border text-foreground hover:bg-accent"}`}>{children}</button>
  );
}

function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return <div className="flex items-center justify-between"><span className="text-muted-foreground">{label}</span>{children}</div>;
}

// silence unused warn in some builds
void fromMinor;
