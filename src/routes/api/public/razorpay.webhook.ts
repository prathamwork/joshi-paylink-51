import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhookSignature } from "@/lib/razorpay.server";

export const Route = createFileRoute("/api/public/razorpay/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const sig = request.headers.get("x-razorpay-signature");
        if (!verifyWebhookSignature(raw, sig)) return new Response("Invalid signature", { status: 401 });

        let event: {
          event: string;
          id?: string;
          created_at?: number;
          payload?: {
            payment?: { entity?: { id?: string; order_id?: string; amount?: number; currency?: string; status?: string; error_code?: string; error_description?: string } };
            order?: { entity?: { id?: string; status?: string; amount?: number; currency?: string } };
          };
        };
        try { event = JSON.parse(raw); } catch { return new Response("Bad JSON", { status: 400 }); }

        const eventId = event.id ?? `${event.event}-${event.payload?.payment?.entity?.id ?? event.payload?.order?.entity?.id ?? crypto.randomUUID()}`;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // idempotent dedupe via unique constraint on event_id
        const { error: dedupeErr } = await supabaseAdmin.from("webhook_events").insert({
          provider: "razorpay",
          event_id: eventId,
          event_type: event.event,
          payload: event as unknown as object,
        });
        if (dedupeErr && !/duplicate/i.test(dedupeErr.message)) {
          console.error("[webhook] insert failed", dedupeErr.message);
          return new Response("DB error", { status: 500 });
        }
        if (dedupeErr) {
          // already processed
          return Response.json({ ok: true, deduped: true });
        }

        try {
          if (event.event === "payment.captured" || event.event === "order.paid") {
            const orderId = event.payload?.payment?.entity?.order_id ?? event.payload?.order?.entity?.id;
            const paymentId = event.payload?.payment?.entity?.id;
            if (orderId) {
              const { data: attempt } = await supabaseAdmin
                .from("payment_attempts")
                .select("id, link_id, status")
                .eq("razorpay_order_id", orderId)
                .maybeSingle();
              if (attempt) {
                await supabaseAdmin
                  .from("payment_attempts")
                  .update({ status: "captured", razorpay_payment_id: paymentId ?? null })
                  .eq("id", attempt.id);
                // single_use / idempotent: only flip active -> paid
                await supabaseAdmin
                  .from("payment_links")
                  .update({ status: "paid" })
                  .eq("id", attempt.link_id)
                  .in("status", ["active"]);
              }
            }
          } else if (event.event === "payment.failed") {
            const p = event.payload?.payment?.entity;
            if (p?.order_id) {
              await supabaseAdmin
                .from("payment_attempts")
                .update({
                  status: "failed",
                  razorpay_payment_id: p.id ?? null,
                  error_code: p.error_code ?? null,
                  error_description: p.error_description ?? null,
                })
                .eq("razorpay_order_id", p.order_id);
            }
          }

          await supabaseAdmin
            .from("webhook_events")
            .update({ processed_at: new Date().toISOString() })
            .eq("event_id", eventId);
        } catch (e) {
          console.error("[webhook] processing error", e instanceof Error ? e.message : "unknown");
          return new Response("processing error", { status: 500 });
        }

        return Response.json({ ok: true });
      },
    },
  },
});
