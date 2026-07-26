import { z } from "zod";
import { CURRENCY_CODES } from "./currency";

export const currencySchema = z.enum(CURRENCY_CODES as [string, ...string[]]);

export const createLinkSchema = z.object({
  client_name: z.string().trim().min(1).max(120),
  client_email: z.string().trim().email().max(200).optional().or(z.literal("").transform(() => undefined)),
  client_phone: z.string().trim().max(40).optional().or(z.literal("").transform(() => undefined)),
  client_country: z.string().trim().max(80).optional().or(z.literal("").transform(() => undefined)),
  project_title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional().or(z.literal("").transform(() => undefined)),
  invoice_ref: z.string().trim().max(80).optional().or(z.literal("").transform(() => undefined)),
  base_amount_minor: z.number().int().positive().max(10_000_000_000),
  currency: currencySchema,
  allow_tip: z.boolean().default(true),
  tip_presets: z.array(z.number().int().min(0).max(100)).max(6).default([5, 10, 15]),
  tip_custom_allowed: z.boolean().default(true),
  tip_min_minor: z.number().int().min(0).default(0),
  tip_max_minor: z.number().int().min(0).nullable().optional(),
  expires_at: z.string().datetime().nullable().optional(),
  single_use: z.boolean().default(true),
  status: z.enum(["draft", "active"]).default("active"),
});
export type CreateLinkInput = z.infer<typeof createLinkSchema>;

export const orderRequestSchema = z.object({
  code: z.string().min(8).max(64),
  tip_type: z.enum(["none", "preset", "custom"]),
  tip_preset_percent: z.number().int().min(0).max(100).optional(),
  tip_custom_minor: z.number().int().min(0).max(10_000_000_000).optional(),
});
export type OrderRequest = z.infer<typeof orderRequestSchema>;

export const verifyRequestSchema = z.object({
  code: z.string().min(8).max(64),
  order_id: z.string().min(3).max(45).regex(/^[A-Za-z0-9_-]+$/),
});
export type VerifyRequest = z.infer<typeof verifyRequestSchema>;
