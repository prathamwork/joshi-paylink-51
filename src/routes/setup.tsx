import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { title: "Cashfree setup — Joshi Web Experts Payments" },
      {
        name: "description",
        content: "Configure Cashfree International Payments for the payments console.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Setup,
});

function Setup() {
  return (
    <div className="min-h-screen bg-background bg-hero-glow">
      <div className="mx-auto max-w-3xl px-6 py-14">
        <Link to="/" className="text-xs text-muted-foreground">
          ← Home
        </Link>
        <h1 className="mt-4 text-4xl font-bold">Cashfree setup guide</h1>
        <p className="mt-2 text-muted-foreground">
          Complete every step in sandbox before accepting a real international payment.
        </p>

        <Section number={1} title="Activate Cashfree International Payment Gateway">
          <p>
            Complete Cashfree merchant onboarding for your Indian business and request International
            Payment Gateway activation. Ask Cashfree to confirm the exact currencies enabled on your
            account, especially <strong>SBD</strong>, VUV, WST and PGK.
          </p>
          <p>
            Currency support in the application does not itself activate a currency on your Cashfree
            merchant account.
          </p>
        </Section>

        <Section number={2} title="Add server-side secrets">
          <p>In your hosting provider's environment settings, add:</p>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-sm">
            <li>
              <code>CASHFREE_CLIENT_ID</code> — sandbox or production App ID.
            </li>
            <li>
              <code>CASHFREE_CLIENT_SECRET</code> — the matching Cashfree secret key.
            </li>
            <li>
              <code>CASHFREE_ENV</code> — use <code>sandbox</code> while testing and{" "}
              <code>production</code> only after approval.
            </li>
            <li>
              <code>APP_BASE_URL</code> — the exact HTTPS origin, for example{" "}
              <code>https://pay.joshiwebexperts.com</code>.
            </li>
          </ul>
          <p className="mt-2 text-sm">
            Never prefix Cashfree secrets with <code>VITE_</code>, commit them to GitHub, or expose
            them to the browser.
          </p>
        </Section>

        <Section number={3} title="Configure the signed webhook">
          <p>In Cashfree Developers → Webhooks, create a Payments webhook pointing to:</p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-card p-3 font-mono text-xs">
            {"{APP_BASE_URL}/api/public/cashfree/webhook"}
          </pre>
          <p className="mt-2 text-sm">Enable the latest webhook version and subscribe to:</p>
          <ul className="list-disc space-y-1 pl-6 text-sm">
            <li>
              <code>PAYMENT_SUCCESS_WEBHOOK</code>
            </li>
            <li>
              <code>PAYMENT_FAILED_WEBHOOK</code>
            </li>
            <li>
              <code>PAYMENT_USER_DROPPED_WEBHOOK</code>
            </li>
          </ul>
          <p className="mt-2 text-sm">
            The server verifies <code>x-webhook-signature</code> against the untouched raw request
            body and deduplicates repeated events.
          </p>
        </Section>

        <Section number={4} title="Apply the Supabase migration">
          <p>Apply the latest migration before opening checkout:</p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-card p-3 font-mono text-xs">
            supabase db push
          </pre>
          <p className="mt-2 text-sm">
            The migration adds Cashfree order/payment fields, webhook deduplication and a database
            rule that blocks payment attempts for inactive or expired links.
          </p>
        </Section>

        <Section number={5} title="Test the complete sandbox flow">
          <ol className="list-decimal space-y-1 pl-6 text-sm">
            <li>Create an SBD payment link from the owner dashboard.</li>
            <li>Open the public link in a private browser window.</li>
            <li>Select no tip, a preset tip and a custom tip in separate tests.</li>
            <li>Complete Cashfree sandbox checkout and confirm the return page.</li>
            <li>
              Verify the signed webhook changes the attempt to success and produces a printable
              receipt.
            </li>
            <li>Test failure, customer abandonment, expiry and duplicate-click behaviour.</li>
          </ol>
        </Section>

        <Section number={6} title="Go live carefully">
          <p>
            Replace sandbox credentials with production credentials, set{" "}
            <code>CASHFREE_ENV=production</code>, confirm the live webhook, and send a small
            internal live payment first.
          </p>
          <p>
            The customer page shows only the invoice currency, such as SBD. It does not show your
            INR settlement value.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="glass mt-8 rounded-2xl p-6">
      <div className="text-xs text-muted-foreground">Step {number}</div>
      <h2 className="mt-1 text-xl font-semibold">{title}</h2>
      <div className="mt-3 space-y-2 text-sm text-foreground/90">{children}</div>
    </section>
  );
}
