// Server-only Cashfree helpers. Never import this module from client code.
import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { fromMinor, toMinor, type CurrencyCode } from "@/lib/currency";

const API_VERSION = "2025-01-01";

export type CashfreeMode = "sandbox" | "production";

export function requireCashfreeEnv() {
  const clientId = process.env.CASHFREE_CLIENT_ID;
  const clientSecret = process.env.CASHFREE_CLIENT_SECRET;
  const mode = (process.env.CASHFREE_ENV ?? "sandbox").toLowerCase() as CashfreeMode;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Cashfree is not configured. Add CASHFREE_CLIENT_ID and CASHFREE_CLIENT_SECRET in Project Settings → Secrets.",
    );
  }
  if (mode !== "sandbox" && mode !== "production") {
    throw new Error("CASHFREE_ENV must be either sandbox or production.");
  }

  return { clientId, clientSecret, mode };
}

export function requireAppBaseUrl() {
  const value = process.env.APP_BASE_URL;
  if (!value) throw new Error("APP_BASE_URL is not configured.");
  const url = new URL(value);
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("APP_BASE_URL must use HTTPS in production.");
  }
  return url.origin;
}

function apiBase(mode: CashfreeMode) {
  return mode === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
}

function cashfreeHeaders(idempotencyKey?: string) {
  const { clientId, clientSecret } = requireCashfreeEnv();
  return {
    "Content-Type": "application/json",
    "x-api-version": API_VERSION,
    "x-client-id": clientId,
    "x-client-secret": clientSecret,
    "x-request-id": randomUUID(),
    ...(idempotencyKey ? { "x-idempotency-key": idempotencyKey } : {}),
  };
}

export interface CashfreeOrder {
  cf_order_id: string;
  order_id: string;
  order_amount: number;
  order_currency: string;
  order_status: "ACTIVE" | "PAID" | "EXPIRED" | "TERMINATED" | "TERMINATION_REQUESTED" | string;
  payment_session_id: string;
  order_expiry_time?: string;
  created_at?: string;
}

export async function createCashfreeOrder(input: {
  orderId: string;
  amountMinor: number;
  currency: CurrencyCode;
  customer: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
  };
  returnUrl: string;
  notifyUrl: string;
  note: string;
  expiresAt?: string | null;
  tags?: Record<string, string>;
}): Promise<CashfreeOrder> {
  const { mode } = requireCashfreeEnv();
  const orderAmount = fromMinor(input.amountMinor, input.currency);
  if (!Number.isFinite(orderAmount) || orderAmount < 1) {
    throw new Error(`Cashfree requires an order amount of at least 1 ${input.currency}.`);
  }

  const body = {
    order_id: input.orderId,
    order_amount: orderAmount,
    order_currency: input.currency,
    customer_details: {
      customer_id: input.customer.id.slice(0, 50),
      customer_name: input.customer.name.slice(0, 100),
      customer_email: input.customer.email?.slice(0, 200) || undefined,
      customer_phone: normalizePhone(input.customer.phone),
    },
    order_meta: {
      return_url: input.returnUrl,
      notify_url: input.notifyUrl,
    },
    order_note: input.note.slice(0, 200),
    order_expiry_time: input.expiresAt || undefined,
    order_tags: input.tags,
  };

  const response = await fetch(`${apiBase(mode)}/orders`, {
    method: "POST",
    headers: cashfreeHeaders(randomUUID()),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const message = await safeProviderError(response);
    throw new Error(`Cashfree order creation failed (${response.status}): ${message}`);
  }

  const order = (await response.json()) as CashfreeOrder;
  if (!order.order_id || !order.payment_session_id) {
    throw new Error("Cashfree returned an incomplete order response.");
  }
  return order;
}

export async function getCashfreeOrder(orderId: string): Promise<CashfreeOrder> {
  const { mode } = requireCashfreeEnv();
  const response = await fetch(`${apiBase(mode)}/orders/${encodeURIComponent(orderId)}`, {
    method: "GET",
    headers: cashfreeHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await safeProviderError(response);
    throw new Error(`Cashfree order lookup failed (${response.status}): ${message}`);
  }
  return (await response.json()) as CashfreeOrder;
}

export function providerAmountToMinor(amount: number, currency: CurrencyCode) {
  return toMinor(amount, currency);
}

export function verifyCashfreeWebhookSignature(
  rawBody: string,
  timestamp: string | null,
  signature: string | null,
): boolean {
  if (!timestamp || !signature) return false;

  const { clientSecret } = requireCashfreeEnv();
  const webhookSecret = process.env.CASHFREE_WEBHOOK_SECRET || clientSecret;
  const expected = createHmac("sha256", webhookSecret)
    .update(timestamp + rawBody)
    .digest("base64");

  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (receivedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(receivedBuffer, expectedBuffer);
}

export function isFreshCashfreeWebhook(timestamp: string, maxAgeMs = 10 * 60 * 1000) {
  const value = Number(timestamp);
  if (!Number.isFinite(value)) return false;
  return Math.abs(Date.now() - value) <= maxAgeMs;
}

function normalizePhone(value?: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length >= 7 && digits.length <= 15) return digits;
  // Cashfree requires a phone field. This neutral fallback is used only when the
  // owner did not store the customer's phone number on the payment request.
  return "9999999999";
}

async function safeProviderError(response: Response) {
  try {
    const data = (await response.json()) as { message?: string; type?: string; code?: string };
    return [data.message, data.type, data.code].filter(Boolean).join(" · ").slice(0, 400) || "Provider error";
  } catch {
    return (await response.text()).slice(0, 400) || "Provider error";
  }
}
