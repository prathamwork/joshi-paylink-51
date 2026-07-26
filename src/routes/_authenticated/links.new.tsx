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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCIES, formatMoney, toMinor, type CurrencyCode } from "@/lib/currency";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/links/new")({
  head: () => ({
    meta: [
      { title: "New payment link — Joshi Web Experts" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: NewLink,
});

function NewLink() {
  const navigate = useNavigate();
  const create = useServerFn(createPaymentLink);
  const getBusinessSettings = useServerFn(getSettings);
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => getBusinessSettings(),
  });

  const [form, setForm] = useState({
    client_name: "",
    client_email: "",
    client_phone: "",
    client_country: "",
    project_title: "",
    description: "",
    invoice_ref: "",
    amount: "" as string,
    currency: "SBD" as CurrencyCode,
    allow_tip: true,
    single_use: true,
    tip_presets: [5, 10, 15] as number[],
    tip_custom_allowed: true,
    expires_at: "" as string,
  });

  const amountMinor = form.amount ? toMinor(Number(form.amount), form.currency) : 0;
  const exponent = CURRENCIES[form.currency].exponent;
  const amountStep = exponent === 0 ? "1" : "0.01";
  const amountMin = exponent === 0 ? "1" : "0.01";

  const mutation = useMutation({
    mutationFn: () =>
      create({
        data: {
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
        },
      }),
    onSuccess: (row) => {
      toast.success("Payment link created");
      navigate({ to: "/links/$id", params: { id: (row as { id: string }).id } });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed"),
  });

  const enabled = (settings?.enabled_currencies as string[] | undefined) ?? Object.keys(CURRENCIES);

  return (
    <AdminShell title="New payment link">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="glass space-y-5 p-6 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Client name *">
              <Input
                value={form.client_name}
                onChange={(event) => setForm({ ...form, client_name: event.target.value })}
                maxLength={120}
                required
              />
            </Field>
            <Field label="Project / service *">
              <Input
                value={form.project_title}
                onChange={(event) => setForm({ ...form, project_title: event.target.value })}
                maxLength={160}
                required
              />
            </Field>
            <Field label="Client email">
              <Input
                type="email"
                value={form.client_email}
                onChange={(event) => setForm({ ...form, client_email: event.target.value })}
              />
            </Field>
            <Field label="Client phone">
              <Input
                value={form.client_phone}
                onChange={(event) => setForm({ ...form, client_phone: event.target.value })}
              />
            </Field>
            <Field label="Client country">
              <Input
                value={form.client_country}
                onChange={(event) => setForm({ ...form, client_country: event.target.value })}
              />
            </Field>
            <Field label="Invoice reference">
              <Input
                value={form.invoice_ref}
                onChange={(event) => setForm({ ...form, invoice_ref: event.target.value })}
              />
            </Field>
          </div>

          <Field label="Description">
            <Textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              maxLength={2000}
              rows={3}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Amount *">
              <Input
                type="number"
                min={amountMin}
                step={amountStep}
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: event.target.value })}
                required
              />
            </Field>
            <Field label="Currency">
              <Select
                value={form.currency}
                onValueChange={(value) => setForm({ ...form, currency: value as CurrencyCode })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {enabled
                    .filter((currency): currency is CurrencyCode => currency in CURRENCIES)
                    .map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currency} — {CURRENCIES[currency].label}
                        {CURRENCIES[currency].requiresIntl ? " ⚠️" : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Expires at">
              <Input
                type="datetime-local"
                value={form.expires_at}
                onChange={(event) => setForm({ ...form, expires_at: event.target.value })}
              />
            </Field>
          </div>

          {CURRENCIES[form.currency]?.requiresIntl && (
            <p className="text-xs text-warning">
              ⚠️ Cashfree must approve International Payment Gateway and enable {form.currency} on
              your merchant account before live use.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={form.allow_tip}
                onCheckedChange={(value) => setForm({ ...form, allow_tip: value })}
              />{" "}
              Allow tips
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={form.tip_custom_allowed}
                onCheckedChange={(value) => setForm({ ...form, tip_custom_allowed: value })}
              />{" "}
              Allow custom tip
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={form.single_use}
                onCheckedChange={(value) => setForm({ ...form, single_use: value })}
              />{" "}
              Single-use
            </label>
          </div>

          <Field label="Tip presets (%)">
            <Input
              value={form.tip_presets.join(",")}
              onChange={(event) =>
                setForm({
                  ...form,
                  tip_presets: event.target.value
                    .split(",")
                    .map((value) => Number(value.trim()))
                    .filter((value) => Number.isFinite(value) && value >= 0 && value <= 100)
                    .slice(0, 6),
                })
              }
            />
          </Field>

          <Button
            onClick={() => mutation.mutate()}
            disabled={
              mutation.isPending ||
              !form.client_name ||
              !form.project_title ||
              !form.amount ||
              amountMinor <= 0
            }
            className="w-full bg-brand-gradient font-semibold text-primary-foreground shadow-glow"
          >
            {mutation.isPending ? "Creating…" : "Create payment link"}
          </Button>
        </Card>

        <Card className="glass h-fit p-6 lg:sticky lg:top-6">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Live customer preview
          </div>
          <div className="mt-4">
            <div className="text-sm text-muted-foreground">{form.client_name || "Client name"}</div>
            <div className="mt-1 text-lg font-semibold">
              {form.project_title || "Project title"}
            </div>
            {form.invoice_ref && (
              <div className="mt-1 text-xs text-muted-foreground">Invoice #{form.invoice_ref}</div>
            )}
            {form.description && (
              <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">
                {form.description}
              </p>
            )}
            <div className="mt-6 text-3xl font-bold">
              {amountMinor > 0 ? formatMoney(amountMinor, form.currency) : "—"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              The customer sees {form.currency}; no INR settlement amount is shown.
            </div>
            {form.allow_tip && (
              <div className="mt-2 text-xs text-muted-foreground">
                Tip: {form.tip_presets.join("% · ")}%{form.tip_custom_allowed ? " · Custom" : ""}
              </div>
            )}
          </div>
        </Card>
      </div>
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
