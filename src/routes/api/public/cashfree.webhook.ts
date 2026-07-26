import { createFileRoute } from "@tanstack/react-router";
import {
  isFreshCashfreeWebhook,
  providerAmountToMinor,
  verifyCashfreeWebhookSignature,
} from "@/lib/cashfree.server";
import { isCurrency } from "@/lib/currency";

export const Route = createFileRoute("/api/public/cashfree/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signature = request.headers.get("x-webhook-signature");
        const timestamp = request.headers.get("x-webhook-timestamp");

        if (!verifyCashfreeWebhookSignature(rawBody, timestamp, signature)) {
          return new Response("Invalid signature", { status: 401 });
        }
        if (!timestamp || !isFreshCashfreeWebhook(timestamp)) {
          return new Response("Stale webhook", { status: 401 });
        }

        let event: CashfreeWebhook;
        try {
          event = JSON.parse(rawBody) as CashfreeWebhook;
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }

        const orderId = event.data?.order?.order_id;
        const payment = event.data?.payment;
        if (!event.type || !orderId) return new Response("Invalid payload", { status: 400 });

        const eventId =
          request.headers.get("x-idempotency-key") ||
          [event.type, orderId, payment?.cf_payment_id ?? "none", event.event_time ?? timestamp].join(":");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as any;

        const { error: dedupeError } = await db.from("webhook_events").insert({
          provider: "cashfree",
          event_id: eventId,
          event_type: event.type,
          payload: event,
        });

        if (dedupeError?.code === "23505") {
          return Response.json({ ok: true, deduped: true });
        }
        if (dedupeError) {
          console.error("[cashfree webhook] event insert failed", dedupeError.message);
          return new Response("DB error", { status: 500 });
        }

        try {
          const { data: attempt } = await db
            .from("payment_attempts")
            .select("id, link_id, total_amount_minor, currency, status")
            .eq("cashfree_order_id", orderId)
            .maybeSingle();

          if (!attempt) {
            await markProcessed(db, eventId);
            return Response.json({ ok: true, ignored: "unknown_order" });
          }

          const currencyMatches =
            payment?.payment_currency == null || payment.payment_currency === attempt.currency;
          const amountMatches =
            payment?.payment_amount == null ||
            (isCurrency(attempt.currency) &&
              providerAmountToMinor(Number(payment.payment_amount), attempt.currency) ===
                Number(attempt.total_amount_minor));

          if (!currencyMatches || !amountMatches) {
            await db
              .from("payment_attempts")
              .update({
                status: "failed",
                provider_verified: true,
                error_code: "WEBHOOK_MISMATCH",
                error_description:
                  "Cashfree webhook amount or currency did not match the stored attempt.",
              })
              .eq("id", attempt.id);
            await markProcessed(db, eventId);
            return Response.json({ ok: true, ignored: "amount_or_currency_mismatch" });
          }

          if (event.type === "PAYMENT_SUCCESS_WEBHOOK" && payment?.payment_status === "SUCCESS") {
            await db
              .from("payment_attempts")
              .update({
                status: "success",
                cashfree_payment_id: payment.cf_payment_id ? String(payment.cf_payment_id) : null,
                bank_reference: payment.bank_reference ?? null,
                provider_verified: true,
                error_code: null,
                error_description: null,
              })
              .eq("id", attempt.id);

            const { data: link } = await db
              .from("payment_links")
              .select("single_use")
              .eq("id", attempt.link_id)
              .maybeSingle();

            if (link?.single_use) {
              // Idempotent: only an active single-use request can become paid.
              await db
                .from("payment_links")
                .update({ status: "paid" })
                .eq("id", attempt.link_id)
                .eq("status", "active");
            }
          } else if (event.type === "PAYMENT_FAILED_WEBHOOK") {
            await db
              .from("payment_attempts")
              .update({
                status: "failed",
                cashfree_payment_id: payment?.cf_payment_id ? String(payment.cf_payment_id) : null,
                bank_reference: payment?.bank_reference ?? null,
                provider_verified: true,
                error_code: event.data?.error_details?.error_code ?? "PAYMENT_FAILED",
                error_description:
                  event.data?.error_details?.error_description ??
                  payment?.payment_message ??
                  "Payment failed",
              })
              .eq("id", attempt.id)
              .neq("status", "success");
          } else if (event.type === "PAYMENT_USER_DROPPED_WEBHOOK") {
            await db
              .from("payment_attempts")
              .update({
                status: "user_dropped",
                cashfree_payment_id: payment?.cf_payment_id ? String(payment.cf_payment_id) : null,
                bank_reference: payment?.bank_reference ?? null,
                provider_verified: true,
                error_code: "USER_DROPPED",
                error_description:
                  payment?.payment_message ?? "Customer left checkout before completing payment.",
              })
              .eq("id", attempt.id)
              .neq("status", "success");
          }

          await markProcessed(db, eventId);
        } catch (error) {
          console.error(
            "[cashfree webhook] processing error",
            error instanceof Error ? error.message : "unknown",
          );
          return new Response("Processing error", { status: 500 });
        }

        return Response.json({ ok: true });
      },
    },
  },
});

async function markProcessed(db: any, eventId: string) {
  await db
    .from("webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("provider", "cashfree")
    .eq("event_id", eventId);
}

type CashfreeWebhook = {
  type?: string;
  event_time?: string;
  data?: {
    order?: {
      order_id?: string;
      order_amount?: number;
      order_currency?: string;
    };
    payment?: {
      cf_payment_id?: string | number;
      payment_status?: string;
      payment_amount?: number;
      payment_currency?: string;
      payment_message?: string;
      payment_time?: string;
      bank_reference?: string;
    };
    error_details?: {
      error_code?: string;
      error_description?: string;
      error_reason?: string;
      error_source?: string;
    };
  };
};
