import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CURRENCIES, formatMoney, toMinor, type CurrencyCode } from "@/lib/currency";
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
type CashfreeMode = "sandbox" | "production";
type CheckoutResult = {
  error?: { message?: string };
  paymentDetails?: { paymentMessage?: string };
  redirect?: boolean;
};

declare global {
  interface Window {
    Cashfree?: (options: { mode: CashfreeMode }) => {
      checkout: (options: {
        paymentSessionId: string;
        redirectTarget: "_self" | "_blank" | "_top" | "_modal";
      }) => Promise<CheckoutResult>;
    };
  }
}

function PayPage() {
  const { code } = Route.useParams();
  const [link, setLink] = useState<PublicLinkView | null | undefined>(undefined);
  const [tipMode, setTipMode] = useState<TipMode>("none");
  const [tipPreset, setTipPreset] = useState<number | null>(null);
  const [tipCustom, setTipCustom] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/public/pay/${code}`)
      .then(async (response) => {
        if (response.status === 404) {
          setLink(null);
          return;
        }
        if (!response.ok) throw new Error("Unable to load payment request");
        const data = (await response.json()) as PublicLinkView;
        setLink(data);
        if (data.tip_presets?.length) setTipPreset(data.tip_presets[0]);
      })
      .catch(() => setLink(null));
  }, [code]);

  const currency = link?.currency ?? ("INR" as CurrencyCode);
  const tipMinor = useMemo(() => {
    if (!link || !link.allow_tip || tipMode === "none") return 0;
    if (tipMode === "preset" && tipPreset != null) {
      return Math.round((link.base_amount_minor * tipPreset) / 100);
    }
    if (tipMode === "custom") {
      const value = Number(tipCustom);
      if (!Number.isFinite(value) || value < 0) return 0;
      return toMinor(value, currency);
    }
    return 0;
  }, [link, tipMode, tipPreset, tipCustom, currency]);

  const totalMinor = (link?.base_amount_minor ?? 0) + tipMinor;
  const customTipInvalid = Boolean(
    link &&
    tipMode === "custom" &&
    (tipMinor < link.tip_min_minor ||
      (link.tip_max_minor != null && tipMinor > link.tip_max_minor)),
  );

  async function pay() {
    if (!link || customTipInvalid) return;
    setBusy(true);

    try {
      const response = await fetch(`/api/public/pay/${code}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tip_type: tipMode,
          tip_preset_percent: tipMode === "preset" ? tipPreset : undefined,
          tip_custom_minor: tipMode === "custom" ? tipMinor : undefined,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        paymentSessionId?: string;
        mode?: CashfreeMode;
      };

      if (!response.ok || !data.paymentSessionId || !data.mode) {
        toast.error(data.error ?? "Could not start payment");
        setBusy(false);
        return;
      }
      if (!window.Cashfree) {
        toast.error("Payment library not loaded. Refresh and try again.");
        setBusy(false);
        return;
      }

      const cashfree = window.Cashfree({ mode: data.mode });
      const result = await cashfree.checkout({
        paymentSessionId: data.paymentSessionId,
        redirectTarget: "_self",
      });

      if (result?.error) {
        toast.error(result.error.message ?? "Payment checkout could not be opened.");
        setBusy(false);
      }
    } catch {
      toast.error("Network error. Please try again.");
      setBusy(false);
    }
  }

  if (link === undefined) {
    return (
      <Shell>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Shell>
    );
  }
  if (link === null) {
    return (
      <Shell>
        <Empty title="Link not found" body="This payment link doesn't exist or has been removed." />
      </Shell>
    );
  }
  if (link.effective_status === "paid") {
    return (
      <Shell>
        <Empty title="Already paid" body="This payment has already been completed. Thank you." />
      </Shell>
    );
  }
  if (link.effective_status === "expired") {
    return (
      <Shell>
        <Empty title="Link expired" body="Please contact us for a fresh payment link." />
      </Shell>
    );
  }
  if (link.effective_status === "cancelled") {
    return (
      <Shell>
        <Empty title="Link cancelled" body="This payment request was cancelled." />
      </Shell>
    );
  }
  if (link.effective_status === "draft") {
    return (
      <Shell>
        <Empty title="Not available" body="This link isn't active yet." />
      </Shell>
    );
  }

  return (
    <Shell brand={link.brand_name} tagline={link.brand_tagline}>
      <div className="glass rounded-3xl p-6 shadow-card sm:p-8">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          Payment request
        </div>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{link.project_title}</h1>
        <div className="mt-1 text-sm text-muted-foreground">
          For {link.client_name}
          {link.invoice_ref ? ` · Invoice #${link.invoice_ref}` : ""}
        </div>
        {link.description && (
          <p className="mt-4 whitespace-pre-line text-sm text-muted-foreground">
            {link.description}
          </p>
        )}

        <div className="mt-6 rounded-2xl border border-border bg-background/40 p-5">
          <div className="text-xs text-muted-foreground">Amount due</div>
          <div className="mt-1 text-4xl font-bold tracking-tight">
            {formatMoney(link.base_amount_minor, currency)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Charged in {currency}. No INR amount is shown.
          </div>
        </div>

        {link.allow_tip && (
          <div className="mt-6">
            <div className="text-sm font-medium">
              Add a tip for the team{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <TipChip active={tipMode === "none"} onClick={() => setTipMode("none")}>
                No tip
              </TipChip>
              {link.tip_presets.map((preset) => (
                <TipChip
                  key={preset}
                  active={tipMode === "preset" && tipPreset === preset}
                  onClick={() => {
                    setTipMode("preset");
                    setTipPreset(preset);
                  }}
                >
                  {preset}% ·{" "}
                  {formatMoney(Math.round((link.base_amount_minor * preset) / 100), currency)}
                </TipChip>
              ))}
              {link.tip_custom_allowed && (
                <TipChip active={tipMode === "custom"} onClick={() => setTipMode("custom")}>
                  Custom
                </TipChip>
              )}
            </div>

            {tipMode === "custom" && (
              <div className="mt-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {CURRENCIES[currency].symbol}
                  </span>
                  <Input
                    inputMode={CURRENCIES[currency].exponent === 0 ? "numeric" : "decimal"}
                    step={CURRENCIES[currency].exponent === 0 ? "1" : "0.01"}
                    placeholder={CURRENCIES[currency].exponent === 0 ? "0" : "0.00"}
                    value={tipCustom}
                    onChange={(event) => setTipCustom(event.target.value)}
                    className="max-w-40"
                  />
                </div>
                {customTipInvalid && (
                  <p className="mt-2 text-xs text-destructive">
                    Enter a tip within the permitted range.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 space-y-1.5 border-t border-border pt-4 text-sm">
          <Row label="Base">
            <span>{formatMoney(link.base_amount_minor, currency)}</span>
          </Row>
          <Row label="Tip">
            <span>{formatMoney(tipMinor, currency)}</span>
          </Row>
          <Row label={<span className="font-semibold">Total</span>}>
            <span className="text-lg font-semibold">{formatMoney(totalMinor, currency)}</span>
          </Row>
        </div>

        <Button
          onClick={pay}
          disabled={busy || totalMinor <= 0 || customTipInvalid}
          className="mt-6 w-full bg-brand-gradient py-6 text-base font-semibold text-primary-foreground shadow-glow"
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            `Pay ${formatMoney(totalMinor, currency)} securely`
          )}
        </Button>
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4" /> Secure checkout powered by Cashfree Payments.
        </div>
      </div>
    </Shell>
  );
}

function Shell({
  children,
  brand,
  tagline,
}: {
  children: React.ReactNode;
  brand?: string;
  tagline?: string;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background bg-hero-glow">
      <div className="absolute inset-0 bg-hero-grid opacity-30" />
      <div className="relative mx-auto max-w-lg px-4 pb-16 pt-10 sm:pt-14">
        <div className="mb-6 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-brand-gradient shadow-glow" />
          <div>
            <div className="text-sm font-semibold">{brand ?? "Joshi Web Experts"}</div>
            <div className="text-xs text-muted-foreground">
              {tagline ?? "Premium web experiences"}
            </div>
          </div>
        </div>
        {children}
        <div className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            joshiwebexperts.com
          </Link>
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
      <Link to="/" className="mt-6 inline-flex rounded-full border border-border px-5 py-2 text-sm">
        Go home
      </Link>
    </div>
  );
}

function TipChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
        active
          ? "border-primary bg-primary text-primary-foreground shadow-glow"
          : "border-border text-foreground hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}

function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
