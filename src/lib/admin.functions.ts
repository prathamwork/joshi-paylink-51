import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertOwner } from "@/lib/owner-guard.server";
import { createLinkSchema } from "@/lib/schemas";
import { generatePublicCode } from "@/lib/code";

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = (context.claims as { email?: string })?.email ?? null;
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    return { email, isAdmin: (roles ?? []).some((r) => r.role === "admin") };
  });

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertOwner(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [links, attempts] = await Promise.all([
      supabaseAdmin.from("payment_links").select("id,status,currency,base_amount_minor,created_at,client_name,project_title,public_code").order("created_at", { ascending: false }),
      supabaseAdmin.from("payment_attempts").select("id,link_id,status,base_amount_minor,tip_amount_minor,total_amount_minor,currency,razorpay_payment_id,created_at").eq("status", "captured").order("created_at", { ascending: false }).limit(10),
    ]);

    const allLinks = links.data ?? [];
    const captured = attempts.data ?? [];

    // totals grouped by currency (minor)
    const collected: Record<string, number> = {};
    const tips: Record<string, number> = {};
    for (const a of captured) {
      collected[a.currency] = (collected[a.currency] ?? 0) + Number(a.total_amount_minor);
      tips[a.currency] = (tips[a.currency] ?? 0) + Number(a.tip_amount_minor);
    }

    return {
      collectedByCurrency: collected,
      tipsByCurrency: tips,
      paidCount: allLinks.filter((l) => l.status === "paid").length,
      pendingCount: allLinks.filter((l) => l.status === "active").length,
      totalLinks: allLinks.length,
      recentPayments: captured.map((a) => {
        const link = allLinks.find((l) => l.id === a.link_id);
        return { ...a, link_client: link?.client_name ?? "—", link_project: link?.project_title ?? "—", link_code: link?.public_code };
      }),
    };
  });

export const listLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string; q?: string } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    assertOwner(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("payment_links").select("*").order("created_at", { ascending: false }).limit(200);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    if (data.q) q = q.or(`client_name.ilike.%${data.q}%,project_title.ilike.%${data.q}%,invoice_ref.ilike.%${data.q}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getLinkDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    assertOwner(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: link }, { data: attempts }] = await Promise.all([
      supabaseAdmin.from("payment_links").select("*").eq("id", data.id).maybeSingle(),
      supabaseAdmin.from("payment_attempts").select("*").eq("link_id", data.id).order("created_at", { ascending: false }),
    ]);
    if (!link) throw new Error("Not found");
    return { link, attempts: attempts ?? [] };
  });

export const createPaymentLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createLinkSchema.parse(d))
  .handler(async ({ data, context }) => {
    assertOwner(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = generatePublicCode();
    const { data: row, error } = await supabaseAdmin
      .from("payment_links")
      .insert({
        public_code: code,
        client_name: data.client_name,
        client_email: data.client_email ?? null,
        client_phone: data.client_phone ?? null,
        client_country: data.client_country ?? null,
        project_title: data.project_title,
        description: data.description ?? null,
        invoice_ref: data.invoice_ref ?? null,
        base_amount_minor: data.base_amount_minor,
        currency: data.currency,
        allow_tip: data.allow_tip,
        tip_presets: data.tip_presets,
        tip_custom_allowed: data.tip_custom_allowed,
        tip_min_minor: data.tip_min_minor,
        tip_max_minor: data.tip_max_minor ?? null,
        expires_at: data.expires_at ?? null,
        single_use: data.single_use,
        status: data.status,
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_events").insert({
      actor_user_id: context.userId,
      action: "link.create",
      entity_type: "payment_link",
      entity_id: row.id,
      metadata: { code },
    });
    return row;
  });

export const updateLinkStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: "active" | "cancelled" | "draft" }) =>
    z.object({ id: z.string().uuid(), status: z.enum(["active", "cancelled", "draft"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    assertOwner(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("payment_links")
      .update({ status: data.status })
      .eq("id", data.id)
      .in("status", ["draft", "active", "cancelled"]); // never mutate paid/expired
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_events").insert({
      actor_user_id: context.userId,
      action: `link.status.${data.status}`,
      entity_type: "payment_link",
      entity_id: data.id,
    });
    return { ok: true };
  });

export const duplicateLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    assertOwner(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: src } = await supabaseAdmin.from("payment_links").select("*").eq("id", data.id).maybeSingle();
    if (!src) throw new Error("Not found");
    const code = generatePublicCode();
    const { data: row, error } = await supabaseAdmin.from("payment_links").insert({
      public_code: code,
      client_name: src.client_name,
      client_email: src.client_email,
      client_phone: src.client_phone,
      client_country: src.client_country,
      project_title: src.project_title,
      description: src.description,
      invoice_ref: src.invoice_ref,
      base_amount_minor: src.base_amount_minor,
      currency: src.currency,
      allow_tip: src.allow_tip,
      tip_presets: src.tip_presets,
      tip_custom_allowed: src.tip_custom_allowed,
      tip_min_minor: src.tip_min_minor,
      tip_max_minor: src.tip_max_minor,
      single_use: src.single_use,
      status: "active",
      created_by: context.userId,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertOwner(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("business_settings").select("*").eq("id", 1).single();
    return data!;
  });

export const updateSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      brand_name: z.string().min(1).max(120),
      brand_tagline: z.string().max(240),
      support_email: z.string().email().max(200),
      support_phone: z.string().max(40).optional().nullable(),
      enabled_currencies: z.array(z.string().length(3)).min(1),
      default_tip_presets: z.array(z.number().int().min(0).max(100)).min(1).max(6),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    assertOwner(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("business_settings").update(data).eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
