# Joshi Web Experts PayLink

A private payment-link generator and premium customer checkout for Joshi Web Experts. The owner creates a branded payment request, shares its `/pay/:code` URL, and the customer can optionally add a tip before paying through Cashfree Hosted Checkout.

## Main capabilities

- Owner-only dashboard protected with Supabase Auth, RLS and an email allow-list.
- Non-enumerable public payment links with draft, active, paid, expired and cancelled states.
- Native international invoice currencies, including SBD, VUV, WST, PGK, USD, AUD and NZD.
- Optional preset or custom tips calculated in the same invoice currency.
- Cashfree order creation performed only on the server.
- Amount, currency and tip rules always reloaded from the database and recalculated server-side.
- Signed Cashfree webhooks with raw-body verification, timestamp validation and event deduplication.
- Server-to-server order verification after checkout returns.
- Printable customer receipt without card details or INR settlement information.
- Single-use payment-link enforcement and one in-progress checkout session per link.

> Currency availability depends on what Cashfree has activated for your merchant account. Confirm SBD and every other international currency with Cashfree before sending live links.

## Technology

- TanStack Start
- React 19 and TypeScript
- Tailwind CSS and shadcn/ui
- Supabase Auth, PostgreSQL and Row Level Security
- Cashfree Payments API and Hosted Checkout SDK v3

## Local development

Requirements: Node.js 22+ and Bun.

```bash
git clone https://github.com/prathamwork/joshi-paylink-51.git
cd joshi-paylink-51
bun install
bun run dev
```

Use a `.env.local` file for local values. Never commit Cashfree secrets.

## Environment variables

```dotenv
# Existing Supabase values
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...

# Cashfree server-only values
CASHFREE_CLIENT_ID=...
CASHFREE_CLIENT_SECRET=...
CASHFREE_ENV=sandbox
APP_BASE_URL=https://your-payment-domain.example
```

`CASHFREE_ENV` accepts only `sandbox` or `production`.

Do not expose `CASHFREE_CLIENT_SECRET` through a `VITE_` variable. Cashfree credentials are used only by server routes.

## Database setup

Apply all Supabase migrations:

```bash
supabase db push
```

The Cashfree migration adds provider-specific order and payment identifiers, a broader attempt status machine, webhook deduplication and database-level checks that reject attempts for inactive or expired links.

The initial owner email is fixed to:

```text
pratham.work3115@gmail.com
```

Only this confirmed account receives the `admin` role through the database trigger.

## Cashfree dashboard configuration

1. Complete Indian merchant onboarding.
2. Request International Payment Gateway activation.
3. Ask Cashfree to enable the required currencies, especially SBD, VUV, WST and PGK.
4. In sandbox, create a Payments webhook at:

```text
{APP_BASE_URL}/api/public/cashfree/webhook
```

5. Subscribe to the latest versions of:
   - `PAYMENT_SUCCESS_WEBHOOK`
   - `PAYMENT_FAILED_WEBHOOK`
   - `PAYMENT_USER_DROPPED_WEBHOOK`
6. Test order creation, checkout return, signed webhook processing and the printable receipt.
7. After approval, replace sandbox credentials with live credentials and set `CASHFREE_ENV=production`.

## Payment flow

1. The owner creates a payment link with client, project, amount, currency, tip rules and expiry.
2. The customer opens `/pay/:code` and sees only the invoice currency.
3. The browser submits only the selected tip mode.
4. The server reloads the link, validates its status and recomputes the final amount.
5. The server reserves a payment attempt and creates a Cashfree order.
6. Cashfree Hosted Checkout handles card/payment details.
7. On return, the app retrieves the order directly from Cashfree.
8. A signed webhook remains the authoritative asynchronous confirmation and updates the dashboard idempotently.

## Security notes

- Public users never query payment tables directly.
- Card details are not handled or stored by this application.
- Public link responses exclude client email, phone, database IDs and provider secrets.
- Webhook signatures are verified using the untouched raw request body.
- Webhook timestamps older than ten minutes are rejected.
- Provider amount and currency must exactly match the stored attempt.
- Duplicate webhook events are ignored by a `(provider, event_id)` unique index.
- A partial unique index permits only one in-progress checkout session per link.
- Admin and payment pages use `noindex, nofollow` metadata.

## Checks

```bash
bun run lint
bun run build
```

GitHub Actions runs both checks on pull requests and pushes to `main`.

## Deployment

Deploy to a host that supports TanStack Start server routes and securely provides server-side environment variables. Set `APP_BASE_URL` to the final HTTPS origin, then update the Cashfree webhook URL to match it exactly.

Do not deploy with sandbox credentials to a public production payment domain.
