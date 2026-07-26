import { createFileRoute } from "@tanstack/react-router";
import { randomUUID } from "crypto";
import { orderRequestSchema } from "@/lib/schemas";
import { loadPublicLink } from "@/lib/public-link.server";
import {
  createCashfreeOrder,
  requireAppBaseUrl,
  requireCashfreeEnv,
} from "@/lib/cashfree.server";

const OPEN_ATTEMPT_STATUSES = ["initializing", "created", "pending", "verification_pending"];
const OPEN_ATTEMPT_MAX_AGE_MS = 30 * 60 * 1000;

export const Route = createFileRoute("/api/public/pay/$code/order")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }

        const parsed = orderRequestSchema.safeParse({ ...(body as object), code: params.code });
        if (!parsed.success) return json({ error: "Invalid request" }, 400);
        const input = parsed.data;

        const view = await loadPublicLink(params.code);
        if (!view) return json({ error: "Link not found" }, 404);
        if (view.effective_status !== "active") return json({ error: `Link ${view.effective_status}` }, 409);

        // The browser only selects a permitted tip option. The payable amount is
        // always recalculated from the database on the server.
        let tipMinor = 0;
        if (view.allow_tip) {
          if (input.tip_type === "preset" && input.tip_preset_percent != null) {
            if (!view.tip_presets.includes(input.tip_preset_percent)) {
              return json({ error: "Invalid tip preset" }, 400);
            }
            tipMinor = Math.round((view.base_amount_minor * input.tip_preset_percent) / 100);
          } else if (input.tip_type === "custom" && input.tip_custom_minor != null) {
            if (!view.tip_custom_allowed) return json({ error: "Custom tip not allowed" }, 400);
            tipMinor = Math.max(0, Math.floor(input.tip_custom_minor));
            if (tipMinor < view.tip_min_minor) return json({ error: "Tip below minimum" }, 400);
            if (view.tip_max_minor != null && tipMinor > view.tip_max_minor) {
              return json({ error: "Tip above maximum" }, 400);
            }
          }
        }

        const totalMinor = view.base_amount_minor + tipMinor;
        if (totalMinor <= 0) return json({ error: "Invalid amount" }, 400);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // Generated Supabase types intentionally lag the additive Cashfree migration.
        // Keep the cast local until types are regenerated from the deployed schema.
        const db = supabaseAdmin as any;
        const { data: linkRow } = await db
          .from("payment_links")
          .select("id, client_email, client_phone, expires_at")
          .eq("public_code", params.code)
          .maybeSingle();
        if (!linkRow) return json({ error: "Link not found" }, 404);

        const { data: openAttempt } = await db
          .from("payment_attempts")
          .select("id, cashfree_order_id, cashfree_payment_session_id, base_amount_minor, tip_amount_minor, total_amount_minor, currency, created_at")
          .eq("link_id", linkRow.id)
          .in("status", OPEN_ATTEMPT_STATUSES)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (openAttempt) {
          const age = Date.now() - new Date(openAttempt.created_at).getTime();
          const amountsMatch =
            Number(openAttempt.base_amount_minor) === view.base_amount_minor &&
            Number(openAttempt.tip_amount_minor) === tipMinor &&
            Number(openAttempt.total_amount_minor) === totalMinor &&
            openAttempt.currency === view.currency;

          if (age <= OPEN_ATTEMPT_MAX_AGE_MS && openAttempt.cashfree_payment_session_id && amountsMatch) {
            const { mode } = requireCashfreeEnv();
            return json({
              orderId: openAttempt.cashfree_order_id,
              paymentSessionId: openAttempt.cashfree_payment_session_id,
              mode,
              amount: totalMinor,
              currency: view.currency,
              baseMinor: view.base_amount_minor,
              tipMinor,
              totalMinor,
              brand: view.brand_name,
              description: view.project_title,
              reused: true,
            });
          }

          await db.from("payment_attempts").update({ status: "expired" }).eq("id", openAttempt.id);
        }

        const orderId = createOrderId(params.code);
        const { data: attempt, error: reserveError } = await db
          .from("payment_attempts")
          .insert({
            link_id: linkRow.id,
            provider: "cashfree",
            cashfree_order_id: orderId,
            base_amount_minor: view.base_amount_minor,
            tip_amount_minor: tipMinor,
            total_amount_minor: totalMinor,
            currency: view.currency,
            status: "initializing",
          })
          .select("id")
          .single();

        if (reserveError) {
          if (reserveError.code === "23505") {
            return json({ error: "A payment session is already being prepared. Please retry in a moment." }, 409);
          }
          console.error("[attempts] reservation failed", reserveError.message);
          return json({ error: "Could not initialize payment." }, 500);
        }

        let order;
        try {
          const appBaseUrl = requireAppBaseUrl();
          order = await createCashfreeOrder({
            orderId,
            amountMinor: totalMinor,
            currency: view.currency,
            customer: {
              id: `client_${params.code.slice(0, 20)}`,
              name: view.client_name,
              email: linkRow.client_email,
              phone: linkRow.client_phone,
            },
            returnUrl: `${appBaseUrl}/pay/${encodeURIComponent(params.code)}/success?order_id=${encodeURIComponent(orderId)}`,
            notifyUrl: `${appBaseUrl}/api/public/cashfree/webhook`,
            note: `Payment for ${view.project_title}`,
            expiresAt: linkRow.expires_at,
            tags: {
              payment_link: params.code.slice(0, 50),
              project: view.project_title.slice(0, 100),
            },
          });
        } catch (error) {
          await db
            .from("payment_attempts")
            .update({
              status: "failed",
              error_code: "ORDER_CREATION_FAILED",
              error_description: error instanceof Error ? error.message.slice(0, 500) : "Cashfree order creation failed",
            })
            .eq("id", attempt.id);
          console.error("[cashfree] order error", error instanceof Error ? error.message : "unknown");
          return json({ error: "Payment provider unavailable. Please retry shortly." }, 502);
        }

        const { error: updateError } = await db
          .from("payment_attempts")
          .update({
            cashfree_cf_order_id: order.cf_order_id,
            cashfree_payment_session_id: order.payment_session_id,
            status: "created",
          })
          .eq("id", attempt.id);

        if (updateError) {
          console.error("[attempts] Cashfree session update failed", updateError.message);
          return json({ error: "Could not save the payment session." }, 500);
        }

        const { mode } = requireCashfreeEnv();
        return json({
          orderId: order.order_id,
          paymentSessionId: order.payment_session_id,
          mode,
          amount: totalMinor,
          currency: order.order_currency,
          baseMinor: view.base_amount_minor,
          tipMinor,
          totalMinor,
          brand: view.brand_name,
          description: view.project_title,
          reused: false,
        });
      },
    },
  },
});

function createOrderId(code: string) {
  const safeCode = code.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 10);
  const suffix = randomUUID().replace(/-/g, "").slice(0, 8);
  return `jwe_${safeCode}_${Date.now().toString(36)}_${suffix}`.slice(0, 45);
}

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}
