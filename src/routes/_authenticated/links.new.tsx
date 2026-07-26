import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createPaymentLink, getSettings } from "@/lib/admin.functions";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CURRENCIES, formatMoney, toMinor, type CurrencyCode } from "@/lib/currency";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/links/new")({
  head: () => ({ meta: [{ title: "New payment link — Joshi Web Experts" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: NewLink,
});

function NewLink() {
  const nav = useNavigate();
  const create = useServerFn(createPaymentLink);
  const settingsFn = useServerFn(getSettings);
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: () => settingsFn() });

  const [form, setForm] = useState({
    client_name: "", client_email: "", client_phone: "", client_country: "",
    project_title: "", description: "", invoice_ref: "",
    amount: "" as string, currency: "INR" as CurrencyCode,
    allow_tip: true, single_use: true,
    tip_presets: [5, 10, 15] as number[], tip_custom_allowed: true,
    expires_at: "" as string,
  });

  const amountMinor = form.amount ? toMinor(Number(form.amount), form.currency) : 0;
  const mut = useMutation({
    mutationFn: () => create({ data: {
      client_name: form.client_name.trim(),
      client_email: form.client_email.trim() || undefined,
      client_phone: form.client_phone.trim() || undefined,
      client_country: form.client_country.trim() || undefined,
      project_title: form.project_title.trim(),
      description: form.description.trim() || undefined,
      invoice_ref: form.invoice_ref.trim() || undefined,
      base_amount_minor: amountMinor,
      currency: form.currency,
      allow_tip: form.allow_tip,
      tip_presets: form.tip_presets,
      tip_custom_allowed: form.tip_custom_allowed,
      tip_min_minor: 0,
      tip_max_minor: null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      single_use: form.single_use,
      status: "active" as const,
    } }),
    onSuccess: (row) => { toast.success("Payment link created"); nav({ to: "/links/$id", params: { id: (row as { id: string }).id } }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const enabled = (settings?.enabled_currencies as string[] | undefined) ?? Object.keys(CURRENCIES);

  return (
    <AdminShell title="New payment link">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="glass p-6 lg:col-span-2 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <F label="Client name *"><Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} maxLength={120} required /></F>
            <F label="Project / service *"><Input value={form.project_title} onChange={(e) => setForm({ ...form, project_title: e.target.value })} maxLength={160} required /></F>
            <F label="Client email"><Input type="email" value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} /></F>
            <F label="Client phone"><Input value={form.client_phone} onChange={(e) => setForm({ ...form, client_phone: e.target.value })} /></F>
            <F label="Client country"><Input value={form.client_country} onChange={(e) => setForm({ ...form, client_country: e.target.value })} /></F>
            <F label="Invoice reference"><Input value={form.invoice_ref} onChange={(e) => setForm({ ...form, invoice_ref: e.target.value })} /></F>
          </div>
          <F label="Description"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={2000} rows={3} /></F>
          <div className="grid gap-4 sm:grid-cols-3">
            <F label="Amount *"><Input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></F>
            <F label="Currency">
              <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v as CurrencyCode })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{enabled.filter((c): c is CurrencyCode => c in CURRENCIES).map((c) => (
                  <SelectItem key={c} value={c}>{c} — {CURRENCIES[c].label}{CURRENCIES[c].requiresIntl ? " ⚠️" : ""}</SelectItem>
                ))}</SelectContent>
              </Select>
            </F>
            <F label="Expires at"><Input type="datetime-local" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} /></F>
          </div>
          {CURRENCIES[form.currency]?.requiresIntl && (
            <p className="text-xs text-warning">⚠️ International currencies require Razorpay account approval and activation.</p>
          )}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm"><Switch checked={form.allow_tip} onCheckedChange={(v) => setForm({ ...form, allow_tip: v })} /> Allow tips</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={form.tip_custom_allowed} onCheckedChange={(v) => setForm({ ...form, tip_custom_allowed: v })} /> Allow custom tip</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={form.single_use} onCheckedChange={(v) => setForm({ ...form, single_use: v })} /> Single-use</label>
          </div>
          <F label="Tip presets (%)"><Input value={form.tip_presets.join(",")} onChange={(e) => setForm({ ...form, tip_presets: e.target.value.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n >= 0 && n <= 100).slice(0, 6) })} /></F>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !form.client_name || !form.project_title || !form.amount} className="w-full bg-brand-gradient text-primary-foreground shadow-glow font-semibold">
            {mut.isPending ? "Creating…" : "Create payment link"}
          </Button>
        </Card>

        <Card className="glass p-6 h-fit sticky top-6">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Live preview</div>
          <div className="mt-4">
            <div className="text-sm text-muted-foreground">{form.client_name || "Client name"}</div>
            <div className="mt-1 text-lg font-semibold">{form.project_title || "Project title"}</div>
            {form.invoice_ref && <div className="mt-1 text-xs text-muted-foreground">Invoice #{form.invoice_ref}</div>}
            {form.description && <p className="mt-3 text-sm text-muted-foreground whitespace-pre-line">{form.description}</p>}
            <div className="mt-6 text-3xl font-bold">{amountMinor > 0 ? formatMoney(amountMinor, form.currency) : "—"}</div>
            {form.allow_tip && <div className="mt-2 text-xs text-muted-foreground">Tip: {form.tip_presets.join("% · ")}%{form.tip_custom_allowed ? " · Custom" : ""}</div>}
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="text-xs text-muted-foreground">{label}</Label><div className="mt-1">{children}</div></div>;
}
