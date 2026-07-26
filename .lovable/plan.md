# Joshi Web Experts Payments — Build Plan

Production-ready payment link generator with Razorpay, TanStack Start + Supabase (Lovable Cloud), owner-only admin, and a premium public checkout page.

## Assumptions (please correct any)
1. **Owner email**: `pratham.work3115@gmail.com` is the ONLY admin. Enforced via DB check + RLS + edge function guard.
2. **Auth**: Email/password only for admin. No public signup UI (owner is seeded / self-signs-up once, then locked to that email).
3. **Razorpay keys**: You will add `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `APP_BASE_URL` in Cloud secrets after I scaffold. I will NOT hardcode or fake anything.
4. **Backend runtime**: Per template rules I'll use **TanStack server routes/functions** (not Supabase Edge Functions — the doc block forbids new edge functions in this stack). All Razorpay logic lives server-side there, reading `process.env` inside handlers. Public webhook lives at `/api/public/razorpay/webhook`. This is functionally equivalent to what you asked for; secrets are still Supabase/Cloud secrets.
5. **Currencies**: INR, USD, GBP, EUR, AUD, CAD, NZD, SGD, AED. Stored as ISO codes with minor-unit exponent map. AED shown but flagged in admin as requiring Razorpay activation.
6. **No deploy** this turn. No Stripe. No fake payments.

## Enable Lovable Cloud
Required for Supabase Auth, DB, RLS, and server-side secret access.

## Database schema (migration, with GRANTs + RLS)

```text
app_role enum: 'admin'
user_roles(user_id, role) — standard has_role() SECURITY DEFINER
profiles(id → auth.users, email, full_name, created_at)
business_settings(id=1 singleton, brand_name, support_email, support_phone,
                  enabled_currencies text[], default_tip_presets int[],
                  brand_tagline, updated_at)
payment_links(
  id uuid pk, public_code text unique (32-char base32, non-enumerable),
  client_name, client_email, client_phone, client_country,
  project_title, description, invoice_ref,
  base_amount_minor bigint, currency text,
  allow_tip bool, tip_presets int[], tip_custom_allowed bool,
  tip_min_minor bigint, tip_max_minor bigint,
  expires_at timestamptz, single_use bool default true,
  status text check in ('draft','active','paid','expired','cancelled'),
  created_by uuid, created_at, updated_at)
payment_attempts(
  id uuid pk, link_id fk, razorpay_order_id unique, razorpay_payment_id,
  base_amount_minor, tip_amount_minor, total_amount_minor, currency,
  status ('created','authorized','captured','failed','verification_pending'),
  signature_verified bool, error_code, error_description,
  created_at, updated_at)
webhook_events(id uuid pk, provider text, event_id text unique,
  event_type, payload jsonb, processed_at, created_at)
audit_events(id, actor_user_id, action, entity_type, entity_id,
  metadata jsonb, created_at)
```

RLS:
- `profiles`, `business_settings`, `payment_links`, `payment_attempts`, `webhook_events`, `audit_events`: SELECT/INSERT/UPDATE only for `has_role(auth.uid(),'admin')`. Service role for server writes.
- **Public** never gets direct table SELECT. Public reads go through a **server route** `/api/public/pay/:code` that returns only: brand info, client_name, project_title, invoice_ref, description, base_amount_minor, currency, tip config, status, expiry — never emails/phones/ids.
- Grants: `authenticated` gets scoped access; `anon` gets nothing on these tables.

## Server routes / functions

Under `src/routes/api/public/` (bypass auth, verified per-handler):
- `POST /api/public/pay/:code/order` — validate link is active + not expired + not paid, compute `base + tip` server-side from allowed presets/custom rules with Zod, create Razorpay order, insert `payment_attempts`, return `{ orderId, keyId, amount, currency, prefill }`.
- `POST /api/public/pay/:code/verify` — verify `razorpay_signature` via HMAC-SHA256(order_id|payment_id, KEY_SECRET). Mark attempt `verification_pending`; webhook is authoritative for `paid`.
- `POST /api/public/razorpay/webhook` — verify `X-Razorpay-Signature` against `RAZORPAY_WEBHOOK_SECRET`, dedupe on `webhook_events.event_id`, handle `payment.captured` / `order.paid` idempotently → set attempt `captured` + link `paid` (respect single_use).
- `GET /api/public/pay/:code` — public link metadata (safe fields only).

Admin server fns (`createServerFn` + `requireSupabaseAuth` + owner-email guard):
- `createPaymentLink`, `updatePaymentLink`, `cancelLink`, `duplicateLink`, `listLinks(filters)`, `getLinkDetail`, `getDashboardStats`, `getBusinessSettings`, `updateBusinessSettings`.

Owner-email guard: middleware checks `claims.email === 'pratham.work3115@gmail.com'` AND `has_role admin`; else 403.

## Routes (TanStack)

Public:
- `/` — marketing landing (brand, "You've been invoiced? Open your link.")
- `/pay/$code` — customer payment page (SSR fetches safe metadata; noindex)
- `/pay/$code/success` — receipt (printable)
- `/setup` — README/setup page for secrets/webhook config
- `/auth` — owner sign-in only (email/password)

Admin (under `_authenticated/`, gated by managed layout + owner-email check in each loader/server-fn):
- `/dashboard` — stat cards (collected, tips, paid, pending) + recent payments
- `/links` — table with filters (status, currency, date, search)
- `/links/new` — wizard with live preview
- `/links/$id` — detail: timeline, attempts, IDs, actions
- `/settings` — brand, currencies, tip defaults, support

## UI / Design
- Dark navy/near-black theme, subtle grid + radial glow, glassmorphism cards, refined micro-animations (framer-motion light), Inter for body + a distinct display font for headings (e.g. Space Grotesk) loaded via `<link>` in `__root`.
- All colors as HSL/oklch tokens in `src/styles.css`; shadcn variants for premium buttons (`hero`, `glass`).
- Mobile-first `/pay/$code`: brand header, client + project summary, base amount hero, tip selector (No tip / % presets / custom), live total, big CTA "Pay ₹X securely", "Payments processed by Razorpay" footer.
- Receipt page: total/base/tip/currency, payment ref, date, support contact, print button, return-home link. No card data.

## Security checklist enforced
- Zod on every input (client + server).
- Amounts recomputed server-side, integer minor units only.
- 32-char base32 random `public_code` via `crypto.getRandomValues`.
- Webhook dedupe (`webhook_events.event_id UNIQUE`), idempotent status updates, single-use enforced in transaction.
- No secret logging; sanitized text via DOMPurify-free approach (plain text only, no `dangerouslySetInnerHTML`).
- `<meta name="robots" content="noindex">` on `/pay/*`, `/dashboard`, `/links/*`, `/settings`, `/auth`.
- OG metadata for `/pay/*` shows brand + "Secure payment request" — never the amount.

## Deliverables in this build
1. Enable Lovable Cloud.
2. Migration with all tables, roles, RLS, GRANTs, `has_role`, `is_owner()` helper.
3. Server routes + server fns above with real Razorpay Orders API + HMAC verify + webhook.
4. All admin pages + public payment page + receipt + landing + setup page.
5. Design system tokens + premium components.
6. README updates + `/setup` page walking through adding the 4 secrets and configuring the webhook URL in Razorpay dashboard.

## What you'll do after I finish
1. Sign up once at `/auth` using `pratham.work3115@gmail.com` — a DB trigger grants the admin role only to that verified email.
2. Add `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `APP_BASE_URL` in Project Settings → Secrets.
3. In Razorpay dashboard, add webhook pointing to `{APP_BASE_URL}/api/public/razorpay/webhook` with events `payment.captured`, `order.paid`, using the same webhook secret.
4. Test in Razorpay test mode, then switch to live keys.

Confirm the assumptions (especially #4 about TanStack server routes replacing Supabase Edge Functions in this template) and I'll build the whole thing.
