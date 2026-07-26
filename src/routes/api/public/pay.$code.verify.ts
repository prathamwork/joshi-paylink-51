import { createFileRoute } from "@tanstack/react-router";
import { verifyRequestSchema } from "@/lib/schemas";
import { verifyCheckoutSignature } from "@/lib/razorpay.server";

export const Route = createFileRoute("/api/public/pay/$code/verify")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        let body: unknown;
        try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
        const parsed = verifyRequestSchema.safeParse({ ...(body as object), code: params.code });
        if (!parsed.success) return json({ error: "Invalid request" }, 400);
        const input = parsed.data;

        const ok = verifyCheckoutSignature(input.razorpay_order_id, input.razorpay_payment_id, input.razorpay_signature);
        if (!ok) return json({ error: "Signature mismatch" }, 400);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // mark attempt as verification_pending; webhook remains authoritative for `captured` -> `paid`.
        await supabaseAdmin
          .from("payment_attempts")
          .update({
            razorpay_payment_id: input.razorpay_payment_id,
            signature_verified: true,
            status: "verification_pending",
          })
          .eq("razorpay_order_id", input.razorpay_order_id);

        return json({ ok: true });
      },
    },
  },
});

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
}
