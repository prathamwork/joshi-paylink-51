import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSettings, updateSettings } from "@/lib/admin.functions";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CURRENCIES } from "@/lib/currency";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Joshi Web Experts" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const fn = useServerFn(getSettings);
  const upd = useServerFn(updateSettings);
  const { data } = useQuery({ queryKey: ["settings"], queryFn: () => fn() });
  const [form, setForm] = useState<null | { brand_name: string; brand_tagline: string; support_email: string; support_phone: string; enabled_currencies: string[]; default_tip_presets: number[] }>(null);
  useEffect(() => { if (data && !form) setForm({
    brand_name: data.brand_name, brand_tagline: data.brand_tagline, support_email: data.support_email, support_phone: data.support_phone ?? "",
    enabled_currencies: data.enabled_currencies, default_tip_presets: data.default_tip_presets,
  }); }, [data, form]);

  const mut = useMutation({
    mutationFn: () => upd({ data: { ...form!, support_phone: form!.support_phone || null } }),
    onSuccess: () => toast.success("Saved"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (!form) return <AdminShell title="Settings"><div className="text-sm text-muted-foreground">Loading…</div></AdminShell>;

  return (
    <AdminShell title="Settings">
      <Card className="glass p-6 max-w-3xl space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <F label="Brand name"><Input value={form.brand_name} onChange={(e) => setForm({ ...form, brand_name: e.target.value })} /></F>
          <F label="Support email"><Input type="email" value={form.support_email} onChange={(e) => setForm({ ...form, support_email: e.target.value })} /></F>
          <F label="Support phone"><Input value={form.support_phone} onChange={(e) => setForm({ ...form, support_phone: e.target.value })} /></F>
          <F label="Default tip presets (%)"><Input value={form.default_tip_presets.join(",")} onChange={(e) => setForm({ ...form, default_tip_presets: e.target.value.split(",").map(s => Number(s.trim())).filter(n => Number.isFinite(n) && n >= 0 && n <= 100).slice(0, 6) })} /></F>
        </div>
        <F label="Brand tagline"><Input value={form.brand_tagline} onChange={(e) => setForm({ ...form, brand_tagline: e.target.value })} /></F>
        <div>
          <Label className="text-xs text-muted-foreground">Enabled currencies</Label>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {Object.entries(CURRENCIES).map(([c, meta]) => {
              const on = form.enabled_currencies.includes(c);
              return (
                <label key={c} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
                  <Checkbox checked={on} onCheckedChange={(v) => setForm({ ...form, enabled_currencies: v ? [...form.enabled_currencies, c] : form.enabled_currencies.filter(x => x !== c) })} />
                  <span>{c}{meta.requiresIntl ? " ⚠️" : ""}</span>
                </label>
              );
            })}
          </div>
          <p className="text-xs text-warning mt-2">⚠️ Non-INR currencies require Razorpay international payments to be activated on your account.</p>
        </div>
        <Button onClick={() => mut.mutate()} disabled={mut.isPending} className="bg-brand-gradient text-primary-foreground shadow-glow font-semibold">Save changes</Button>
      </Card>
    </AdminShell>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="text-xs text-muted-foreground">{label}</Label><div className="mt-1">{children}</div></div>;
}
