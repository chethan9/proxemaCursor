import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const FAQS = [
  {
    q: "Which currencies do you accept?",
    a: "We accept 15+ local currencies including USD, EUR, GBP, INR, KWD, SAR, AED, BHD, OMR, QAR, JOD, and more. Your billing currency is set by your country and locked to your subscription — prices shown here match what you'll be charged.",
  },
  {
    q: "What if my country isn't listed?",
    a: "If your country isn't listed, you'll see prices in USD by default. Reach out at sales@proxima.app and we'll set up local billing for you.",
  },
  {
    q: "Can I change my country or currency later?",
    a: "Yes — update your country in Settings → Profile. Currency changes apply at your next renewal so the current billing period isn't re-charged.",
  },
  {
    q: "What happens if I hit my plan's quota?",
    a: "We'll notify you before you reach limits. If you exceed product, site, or API call quotas, affected features are temporarily restricted until you upgrade or the next billing cycle resets.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from Settings → Billing at any time. Your plan stays active until the end of the current period, then moves to the free tier automatically.",
  },
  {
    q: "Do you offer a free trial?",
    a: "Yes — all paid plans include a 14-day free trial. No credit card required to start. You can cancel or switch plans at any point during the trial.",
  },
  {
    q: "How does annual billing work?",
    a: "Pay upfront for 12 months and save 17% — effectively 2 months free. You can upgrade mid-year (prorated) or downgrade at renewal.",
  },
  {
    q: "Is my WooCommerce data secure?",
    a: "Yes. All credentials are encrypted at rest, data is isolated per-client with row-level security, and we're SOC 2 compliant. We never share or resell your data.",
  },
];

export function PricingFAQ() {
  return (
    <section className="mt-24 max-w-3xl mx-auto">
      <h2 className="text-3xl font-semibold text-center mb-10">Frequently asked questions</h2>
      <Accordion type="single" collapsible className="w-full">
        {FAQS.map((item, i) => (
          <AccordionItem key={i} value={`item-${i}`}>
            <AccordionTrigger className="text-left">{item.q}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed">{item.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}