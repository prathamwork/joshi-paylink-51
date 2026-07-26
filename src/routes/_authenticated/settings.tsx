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
  head: () => ({
    meta: [
      { title: "Settings — Joshi Web Experts" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SettingsPage,
});

type SettingsForm = {
  brand_name: string;
  brand_tagline: string;
  support_email: string;
  support_phone: string;
  enabled_currencies: string[];
  default_tip_presets: number[];
};

function SettingsPage() {
  const getBusinessSettings = useServerFn(getSettings);
  const saveSettings = useServerFn(updateSettings);
  const { data } = useQuery({ queryKey: ["settings"], queryFn: () => getBusinessSettings() });
  const [form, setForm] = useState<SettingsForm | null>(null);

  useEffect(() => {
    if (data && !form) {
      setForm({
        brand_name: data.brand_name,
        brand_tagline: data.brand_tagline,
        support_email: data.support_email,
        support_phone: data.support_phone ?? "",
        enabled_currencies: data.enabled_currencies,
        default_tip_presets: data.default_tip_presets,
      });
    }
  }, [data, form]);

  const mutation = useMutation({
    mutationFn: () => saveSettings({ data: { ...form!, support_phone: form!.support_phone || null } }),
    onSuccess: () => toast.success("Saved"),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed"),
  });

  if (!form) {
    return <AdminShell title="Settings"><div className="text-sm text-muted-foreground">Loading…</div></AdminShell>;
  }

  return (
    <AdminShell title="Settings">
      <Card className="glass max-w-3xl space-y-5 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Brand name">
            <Input value={form.brand_name} onChange={(event) => setForm({ ...form, brand_name: event.target.value })} />
          </Field>
          <Field label="Support email">
            <Input type="email" value={form.support_email} onChange={(event) => setForm({ ...form, support_email: event.target.value })} />
          </Field>
          <Field label="Support phone">
            <Input value={form.support_phone} onChange={(event) => setForm({ ...form, support_phone: event.target.value })} />
          </Field>
          <Field label="Default tip presets (%)">
            <Input
              value={form.default_tip_presets.join(",")}
              onChange={(event) =>
                setForm({
                  ...form,
                  default_tip_presets: event.target.value
                    .split(",")
                    .map((value) => Number(value.trim()))
                    .filter((value) => Number.isFinite(value) && value >= 0 && value <= 100)
                    .slice(0, 6),
                })
              }
            />
          </Field>
        </div>

        <Field label="Brand tagline">
          <Input value={form.brand_tagline} onChange={(event) => setForm({ ...form, brand_tagline: event.target.value })} />
        </Field>

        <div>
          <Label className="text-xs text-muted-foreground">Enabled checkout currencies</Label>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {Object.entries(CURRENCIES).map(([currency, metadata]) => {
              const enabled = form.enabled_currencies.includes(currency);
              return (
                <label key={currency} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
                  <Checkbox
                    checked={enabled}
                    onCheckedChange={(checked) =>
                      setForm({
                        ...form,
                        enabled_currencies: checked
                          ? [...new Set([...form.enabled_currencies, currency])]
                          : form.enabled_currencies.filter((value) => value !== currency),
                      })
                    }
                  />
                  <span>{currency}{metadata.requiresIntl ? " ⚠️" : ""}</span>
                </label>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-warning">
            ⚠️ Cashfree must activate International Payment Gateway and approve each non-INR currency. SBD, VUV, WST and PGK should be confirmed in your merchant dashboard before sending live links.
          </p>
        </div>

        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || form.enabled_currencies.length === 0}
          className="bg-brand-gradient font-semibold text-primary-foreground shadow-glow"
        >
          Save changes
        </Button>
      </Card>
    </AdminShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
