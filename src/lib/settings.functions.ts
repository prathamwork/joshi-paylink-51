import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertOwner } from "@/lib/owner-guard.server";

const DEFAULT_SETTINGS = {
  id: 1,
  brand_name: "Joshi Web Experts",
  brand_tagline: "Secure international payments",
  support_email: "pratham.work3115@gmail.com",
  support_phone: null as string | null,
  enabled_currencies: [
    "SBD",
    "VUV",
    "WST",
    "USD",
    "AUD",
    "NZD",
    "FJD",
    "PGK",
    "EUR",
    "GBP",
    "INR",
  ],
  default_tip_presets: [5, 10, 15],
};

const settingsSchema = z.object({
  brand_name: z.string().min(1).max(120),
  brand_tagline: z.string().max(240),
  support_email: z.string().email().max(200),
  support_phone: z.string().max(40).optional().nullable(),
  enabled_currencies: z.array(z.string().length(3)).min(1),
  default_tip_presets: z.array(z.number().int().min(0).max(100)).min(1).max(6),
});

export const getBusinessSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertOwner(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("business_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (error) throw new Error(`Unable to load settings: ${error.message}`);
    if (data) return data;

    const { data: created, error: createError } = await supabaseAdmin
      .from("business_settings")
      .upsert(DEFAULT_SETTINGS, { onConflict: "id" })
      .select("*")
      .single();

    if (createError) {
      throw new Error(`Unable to initialise settings: ${createError.message}`);
    }

    return created;
  });

export const saveBusinessSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => settingsSchema.parse(data))
  .handler(async ({ data, context }) => {
    assertOwner(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("business_settings")
      .upsert({ id: 1, ...data }, { onConflict: "id" });

    if (error) throw new Error(`Unable to save settings: ${error.message}`);
    return { ok: true };
  });
