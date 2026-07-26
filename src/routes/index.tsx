import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, Zap, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Joshi Web Experts — Payments" },
      {
        name: "description",
        content: "Premium international payment experience by Pratham Joshi. Open your private link to complete payment securely.",
      },
      { property: "og:title", content: "Joshi Web Experts — Payments" },
      { property: "og:description", content: "Secure international payments for Joshi Web Experts clients." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background bg-hero-glow">
      <div className="absolute inset-0 bg-hero-grid opacity-30" />
      <div className="relative mx-auto max-w-5xl px-6">
        <header className="flex items-center justify-between py-6">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-brand-gradient shadow-glow" />
            <div>
              <div className="text-sm font-semibold leading-tight">Joshi Web Experts</div>
              <div className="text-xs text-muted-foreground">International Payments</div>
            </div>
          </div>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link to="/setup" className="hover:text-foreground">Setup</Link>
            <Link to="/auth" className="rounded-full border border-border px-4 py-1.5 hover:bg-accent">Owner sign-in</Link>
          </nav>
        </header>

        <section className="pb-20 pt-16 sm:pt-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3" /> Premium payment experience
          </div>
          <h1 className="mt-6 text-5xl font-bold tracking-tight sm:text-6xl">
            Pay confidently.<br />
            <span className="bg-brand-gradient bg-clip-text text-transparent">In the currency on your invoice.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            If Pratham has shared a private payment link with you, open it to review the project, optionally add a tip and complete payment securely. No account is required.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="mailto:pratham.work3115@gmail.com"
              className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow"
            >
              Contact Pratham <ArrowRight className="h-4 w-4" />
            </a>
            <Link to="/auth" className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm">
              Owner sign-in
            </Link>
          </div>

          <div className="mt-20 grid gap-4 sm:grid-cols-3">
            <Feature icon={<ShieldCheck className="h-5 w-5" />} title="Secure hosted checkout">
              Card details are entered on Cashfree's hosted payment interface. Joshi Web Experts does not store them.
            </Feature>
            <Feature icon={<Zap className="h-5 w-5" />} title="Native invoice currency">
              Eligible links can be presented in SBD, VUV, WST, USD, AUD and other activated currencies without exposing an INR quote.
            </Feature>
            <Feature icon={<Sparkles className="h-5 w-5" />} title="Optional tip">
              If the work delighted you, add a preset or custom tip in the same invoice currency — entirely optional.
            </Feature>
          </div>
        </section>

        <footer className="border-t border-border py-8 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Joshi Web Experts · Secure checkout powered by Cashfree Payments
        </footer>
      </div>
    </div>
  );
}

function Feature({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-6">
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">{icon}</div>
      <div className="mt-3 font-semibold">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
