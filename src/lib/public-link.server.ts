// Server-only, safe helpers. This file must NOT be imported from client code.
import { CURRENCIES, type CurrencyCode, isCurrency } from "@/lib/currency";

export type PublicLinkView = {
  code: string;
  brand_name: string;
  brand_tagline: string;
  support_email: string;
  client_name: string;
  project_title: string;
  invoice_ref: string | null;
  description: string | null;
  base_amount_minor: number;
  currency: CurrencyCode;
  allow_tip: boolean;
  tip_presets: number[];
  tip_custom_allowed: boolean;
  tip_min_minor: number;
  tip_max_minor: number | null;
  status: "draft" | "active" | "paid" | "expired" | "cancelled";
  expires_at: string | null;
  effective_status: "active" | "expired" | "paid" | "cancelled" | "draft";
};

export async function loadPublicLink(code: string): Promise<PublicLinkView | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: link }, { data: settings }] = await Promise.all([
    supabaseAdmin
      .from("payment_links")
      .select("*")
      .eq("public_code", code)
      .maybeSingle(),
    supabaseAdmin
      .from("business_settings")
      .select("brand_name, brand_tagline, support_email")
      .eq("id", 1)
      .maybeSingle(),
  ]);
  if (!link) return null;
  if (!isCurrency(link.currency)) return null;

  let effective = link.status as PublicLinkView["effective_status"];
  if (effective === "active" && link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
    effective = "expired";
  }

  return {
    code: link.public_code,
    brand_name: settings?.brand_name ?? "Joshi Web Experts",
    brand_tagline: settings?.brand_tagline ?? "",
    support_email: settings?.support_email ?? "",
    client_name: link.client_name,
    project_title: link.project_title,
    invoice_ref: link.invoice_ref,
    description: link.description,
    base_amount_minor: Number(link.base_amount_minor),
    currency: link.currency as CurrencyCode,
    allow_tip: link.allow_tip && CURRENCIES[link.currency as CurrencyCode] !== undefined,
    tip_presets: link.tip_presets ?? [],
    tip_custom_allowed: link.tip_custom_allowed,
    tip_min_minor: Number(link.tip_min_minor ?? 0),
    tip_max_minor: link.tip_max_minor == null ? null : Number(link.tip_max_minor),
    status: link.status as PublicLinkView["status"],
    expires_at: link.expires_at,
    effective_status: effective,
  };
}
