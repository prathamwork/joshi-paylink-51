// Server-only Razorpay helpers. Never import this from client code.
import { createHmac, timingSafeEqual } from "crypto";

export function requireRazorpayEnv() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error("Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Project Settings → Secrets.");
  }
  return { keyId, keySecret };
}

export function requireWebhookSecret() {
  const s = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!s) throw new Error("RAZORPAY_WEBHOOK_SECRET is not configured.");
  return s;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
  receipt?: string;
}

export async function createRazorpayOrder(input: {
  amount_minor: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  const { keyId, keySecret } = requireRazorpayEnv();
  const auth = "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify({
      amount: input.amount_minor,
      currency: input.currency,
      receipt: input.receipt.slice(0, 40),
      notes: input.notes ?? {},
      payment_capture: 1,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    // never include secret in message
    throw new Error(`Razorpay order creation failed (${res.status}): ${text.slice(0, 400)}`);
  }
  return (await res.json()) as RazorpayOrder;
}

export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
  const { keySecret } = requireRazorpayEnv();
  const expected = createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const secret = requireWebhookSecret();
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
