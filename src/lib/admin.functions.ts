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
    return { email, isAdmin: (roles ?? []).some((role) => role.role === "admin") };
  });

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertOwner(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin;

    const [links, attempts] = await Promise.all([
      db
        .from("payment_links")
        .select(
          "id,status,currency,base_amount_minor,created_at,client_name,project_title,public_code",
        )
        .order("created_at", { ascending: false }),
      db
        .from("payment_attempts")
        .select(
          "id,link_id,status,base_amount_minor,tip_amount_minor,total_amount_minor,currency,cashfree_payment_id,bank_reference,created_at",
        )
        .eq("provider", "cashfree")
        .eq("status", "success")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const allLinks = links.data ?? [];
    const successful = attempts.data ?? [];
    const collected: Record<string, number> = {};
    const tips: Record<string, number> = {};

    for (const attempt of successful) {
      collected[attempt.currency] =
        (collected[attempt.currency] ?? 0) + Number(attempt.total_amount_minor);
      tips[attempt.currency] = (tips[attempt.currency] ?? 0) + Number(attempt.tip_amount_minor);
    }

    return {
      collectedByCurrency: collected,
      tipsByCurrency: tips,
      paidCount: allLinks.filter((link) => link.status === "paid").length,
      pendingCount: allLinks.filter((link) => link.status === "active").length,
      totalLinks: allLinks.length,
      recentPayments: successful.map((attempt) => {
        const link = allLinks.find((candidate) => candidate.id === attempt.link_id);
        return {
          ...attempt,
          link_client: link?.client_name ?? "—",
          link_project: link?.project_title ?? "—",
          link_code: link?.public_code,
        };
      }),
    };
  });

export const listLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { status?: string; q?: string } | undefined) => data ?? {})
  .handler(async ({ data, context }) => {
    assertOwner(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("payment_links")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status && data.status !== "all") query = query.eq("status", data.status);
    if (data.q) {
      query = query.or(
        `client_name.ilike.%${data.q}%,project_title.ilike.%${data.q}%,invoice_ref.ilike.%${data.q}%`,
      );
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getLinkDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    assertOwner(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin;
    const [{ data: link }, { data: attempts }] = await Promise.all([
      db.from("payment_links").select("*").eq("id", data.id).maybeSingle(),
      db
        .from("payment_attempts")
        .select("*")
        .eq("link_id", data.id)
        .order("created_at", { ascending: false }),
    ]);
    if (!link) throw new Error("Not found");
    return { link, attempts: attempts ?? [] };
  });

export const createPaymentLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createLinkSchema.parse(data))
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
  .inputValidator((data: { id: string; status: "active" | "cancelled" | "draft" }) =>
    z
      .object({ id: z.string().uuid(), status: z.enum(["active", "cancelled", "draft"]) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    assertOwner(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("payment_links")
      .update({ status: data.status })
      .eq("id", data.id)
      .in("status", ["draft", "active", "cancelled"]);
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
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    assertOwner(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: source } = await supabaseAdmin
      .from("payment_links")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!source) throw new Error("Not found");

    const code = generatePublicCode();
    const { data: row, error } = await supabaseAdmin
      .from("payment_links")
      .insert({
        public_code: code,
        client_name: source.client_name,
        client_email: source.client_email,
        client_phone: source.client_phone,
        client_country: source.client_country,
        project_title: source.project_title,
        description: source.description,
        invoice_ref: source.invoice_ref,
        base_amount_minor: source.base_amount_minor,
        currency: source.currency,
        allow_tip: source.allow_tip,
        tip_presets: source.tip_presets,
        tip_custom_allowed: source.tip_custom_allowed,
        tip_min_minor: source.tip_min_minor,
        tip_max_minor: source.tip_max_minor,
        single_use: source.single_use,
        status: "active",
        created_by: context.userId,
      })
      .select("*")
      .single();
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
  .inputValidator((data: unknown) =>
    z
      .object({
        brand_name: z.string().min(1).max(120),
        brand_tagline: z.string().max(240),
        support_email: z.string().email().max(200),
        support_phone: z.string().max(40).optional().nullable(),
        enabled_currencies: z.array(z.string().length(3)).min(1),
        default_tip_presets: z.array(z.number().int().min(0).max(100)).min(1).max(6),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    assertOwner(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("business_settings").update(data).eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
