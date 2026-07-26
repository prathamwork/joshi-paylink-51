import { createFileRoute } from "@tanstack/react-router";
import { orderRequestSchema } from "@/lib/schemas";
import { loadPublicLink } from "@/lib/public-link.server";
import { createRazorpayOrder, requireRazorpayEnv } from "@/lib/razorpay.server";

export const Route = createFileRoute("/api/public/pay/$code/order")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        let body: unknown;
        try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
        const parsed = orderRequestSchema.safeParse({ ...(body as object), code: params.code });
        if (!parsed.success) return json({ error: "Invalid request" }, 400);
        const input = parsed.data;

        const view = await loadPublicLink(params.code);
        if (!view) return json({ error: "Link not found" }, 404);
        if (view.effective_status !== "active") return json({ error: `Link ${view.effective_status}` }, 409);

        // Recompute tip on the server — never trust browser amounts.
        let tipMinor = 0;
        if (view.allow_tip) {
          if (input.tip_type === "preset" && input.tip_preset_percent != null) {
            if (!view.tip_presets.includes(input.tip_preset_percent)) return json({ error: "Invalid tip preset" }, 400);
            tipMinor = Math.round((view.base_amount_minor * input.tip_preset_percent) / 100);
          } else if (input.tip_type === "custom" && input.tip_custom_minor != null) {
            if (!view.tip_custom_allowed) return json({ error: "Custom tip not allowed" }, 400);
            tipMinor = Math.max(0, Math.floor(input.tip_custom_minor));
            if (tipMinor < view.tip_min_minor) return json({ error: "Tip below minimum" }, 400);
            if (view.tip_max_minor != null && tipMinor > view.tip_max_minor) return json({ error: "Tip above maximum" }, 400);
          }
        }
        const totalMinor = view.base_amount_minor + tipMinor;
        if (totalMinor <= 0) return json({ error: "Invalid amount" }, 400);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: linkRow } = await supabaseAdmin
          .from("payment_links")
          .select("id")
          .eq("public_code", params.code)
          .maybeSingle();
        if (!linkRow) return json({ error: "Link not found" }, 404);

        let order;
        try {
          order = await createRazorpayOrder({
            amount_minor: totalMinor,
            currency: view.currency,
            receipt: `${params.code}-${Date.now()}`,
            notes: {
              link_code: params.code,
              client: view.client_name.slice(0, 60),
              project: view.project_title.slice(0, 60),
            },
          });
        } catch (e) {
          console.error("[razorpay] order error", e instanceof Error ? e.message : "unknown");
          return json({ error: "Payment provider unavailable. Please retry shortly." }, 502);
        }

        const { error: insErr } = await supabaseAdmin.from("payment_attempts").insert({
          link_id: linkRow.id,
          razorpay_order_id: order.id,
          base_amount_minor: view.base_amount_minor,
          tip_amount_minor: tipMinor,
          total_amount_minor: totalMinor,
          currency: view.currency,
          status: "created",
        });
        if (insErr) {
          console.error("[attempts] insert error", insErr.message);
          return json({ error: "Could not initialize payment." }, 500);
        }

        const { keyId } = requireRazorpayEnv();
        return json({
          orderId: order.id,
          keyId,
          amount: order.amount,
          currency: order.currency,
          baseMinor: view.base_amount_minor,
          tipMinor,
          totalMinor,
          brand: view.brand_name,
          description: view.project_title,
        });
      },
    },
  },
});

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}
