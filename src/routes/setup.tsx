import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/setup")({
  head: () => ({ meta: [
    { title: "Setup — Joshi Web Experts Payments" },
    { name: "description", content: "Configure Razorpay and secrets for the payments console." },
    { name: "robots", content: "noindex, nofollow" },
  ]}),
  component: Setup,
});

function Setup() {
  return (
    <div className="min-h-screen bg-background bg-hero-glow">
      <div className="mx-auto max-w-3xl px-6 py-14">
        <Link to="/" className="text-xs text-muted-foreground">← Home</Link>
        <h1 className="mt-4 text-4xl font-bold">Setup guide</h1>
        <p className="mt-2 text-muted-foreground">Follow these steps to go live with Razorpay.</p>

        <Section n={1} title="Add your Razorpay secrets">
          <p>In Project Settings → Secrets, add:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1 text-sm">
            <li><code>RAZORPAY_KEY_ID</code> — your Razorpay Key ID (test or live)</li>
            <li><code>RAZORPAY_KEY_SECRET</code> — matching Key Secret</li>
            <li><code>RAZORPAY_WEBHOOK_SECRET</code> — the webhook secret you set in Razorpay</li>
            <li><code>APP_BASE_URL</code> — your public site URL, e.g. <code>https://yourdomain.com</code></li>
          </ul>
        </Section>

        <Section n={2} title="Configure your webhook in Razorpay">
          <p>In the Razorpay Dashboard → Settings → Webhooks, add a webhook pointing to:</p>
          <pre className="mt-2 rounded-lg bg-card p-3 text-xs font-mono overflow-x-auto">{"{APP_BASE_URL}/api/public/razorpay/webhook"}</pre>
          <p className="mt-2 text-sm">Enable events: <code>payment.captured</code>, <code>order.paid</code>, <code>payment.failed</code>. Use the same webhook secret as above.</p>
        </Section>

        <Section n={3} title="Test with Razorpay test mode">
          <p>Create a link in the admin, open it, and pay using Razorpay's <a className="underline" href="https://razorpay.com/docs/payments/payments/test-card-details/" target="_blank" rel="noreferrer">test card</a>. The dashboard should show a captured payment once the webhook fires.</p>
        </Section>

        <Section n={4} title="Enable international currencies (optional)">
          <p>USD, GBP, EUR, AUD, CAD, NZD, SGD and AED require Razorpay to enable international payments on your account. Apply from the Razorpay Dashboard.</p>
        </Section>

        <Section n={5} title="Go live">
          <p>Swap the test keys for live keys in Secrets, update the webhook to the live endpoint's URL, and you're ready.</p>
        </Section>
      </div>
    </div>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 glass rounded-2xl p-6">
      <div className="text-xs text-muted-foreground">Step {n}</div>
      <h2 className="text-xl font-semibold mt-1">{title}</h2>
      <div className="mt-3 text-sm text-foreground/90 space-y-2">{children}</div>
    </section>
  );
}
