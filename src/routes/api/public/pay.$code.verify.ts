import { createFileRoute } from "@tanstack/react-router";
import { verifyRequestSchema } from "@/lib/schemas";
import { getCashfreeOrder, providerAmountToMinor } from "@/lib/cashfree.server";
import { isCurrency } from "@/lib/currency";
import type { Tables } from "@/integrations/supabase/types";

type AttemptReceipt = Pick<
  Tables<"payment_attempts">,
  | "cashfree_order_id"
  | "cashfree_payment_id"
  | "base_amount_minor"
  | "tip_amount_minor"
  | "total_amount_minor"
  | "currency"
  | "updated_at"
>;

type LinkReceipt = Pick<Tables<"payment_links">, "client_name" | "project_title" | "invoice_ref">;

export const Route = createFileRoute("/api/public/pay/$code/verify")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }

        const parsed = verifyRequestSchema.safeParse({ ...(body as object), code: params.code });
        if (!parsed.success) return json({ error: "Invalid request" }, 400);
        const input = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin;

        const { data: link } = await db
          .from("payment_links")
          .select("id, public_code, client_name, project_title, invoice_ref, single_use")
          .eq("public_code", params.code)
          .maybeSingle();
        if (!link) return json({ error: "Link not found" }, 404);

        const { data: attempt } = await db
          .from("payment_attempts")
          .select(
            "id, link_id, cashfree_order_id, cashfree_payment_id, base_amount_minor, tip_amount_minor, total_amount_minor, currency, status, updated_at",
          )
          .eq("cashfree_order_id", input.order_id)
          .eq("link_id", link.id)
          .maybeSingle();
        if (!attempt) return json({ error: "Payment attempt not found" }, 404);
        if (!isCurrency(attempt.currency))
          return json({ error: "Unsupported payment currency" }, 500);

        let order;
        try {
          order = await getCashfreeOrder(input.order_id);
        } catch (error) {
          console.error(
            "[cashfree] verification lookup failed",
            error instanceof Error ? error.message : "unknown",
          );
          return receiptResponse("pending", attempt, link, 202);
        }

        const amountMatches =
          order.order_currency === attempt.currency &&
          providerAmountToMinor(Number(order.order_amount), attempt.currency) ===
            Number(attempt.total_amount_minor);

        if (!amountMatches) {
          await db
            .from("payment_attempts")
            .update({
              status: "failed",
              provider_verified: true,
              error_code: "ORDER_MISMATCH",
              error_description:
                "Cashfree order amount or currency did not match the stored payment request.",
            })
            .eq("id", attempt.id);
          return json({ error: "Payment verification mismatch" }, 409);
        }

        if (order.order_status === "PAID") {
          await db
            .from("payment_attempts")
            .update({ status: "success", provider_verified: true })
            .eq("id", attempt.id)
            .neq("status", "success");

          if (link.single_use) {
            await db
              .from("payment_links")
              .update({ status: "paid" })
              .eq("id", attempt.link_id)
              .eq("status", "active");
          }

          return receiptResponse(
            "paid",
            { ...attempt, updated_at: new Date().toISOString() },
            link,
          );
        }

        if (["EXPIRED", "TERMINATED", "TERMINATION_REQUESTED"].includes(order.order_status)) {
          await db
            .from("payment_attempts")
            .update({ status: "expired", provider_verified: true })
            .eq("id", attempt.id);
          return receiptResponse(
            "failed",
            { ...attempt, updated_at: new Date().toISOString() },
            link,
            409,
          );
        }

        await db
          .from("payment_attempts")
          .update({ status: "verification_pending", provider_verified: true })
          .eq("id", attempt.id)
          .in("status", ["initializing", "created", "pending", "verification_pending"]);
        return receiptResponse("pending", attempt, link, 202);
      },
    },
  },
});

function receiptResponse(
  state: "paid" | "pending" | "failed",
  attempt: AttemptReceipt,
  link: LinkReceipt,
  status = 200,
) {
  return json(
    {
      state,
      orderId: attempt.cashfree_order_id ?? "",
      paymentId: attempt.cashfree_payment_id ?? null,
      baseMinor: Number(attempt.base_amount_minor),
      tipMinor: Number(attempt.tip_amount_minor),
      totalMinor: Number(attempt.total_amount_minor),
      currency: attempt.currency,
      updatedAt: attempt.updated_at,
      clientName: link.client_name,
      projectTitle: link.project_title,
      invoiceRef: link.invoice_ref,
    },
    status,
  );
}

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}
