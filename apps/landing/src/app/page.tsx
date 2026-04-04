import { Metadata } from "next";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { SelfHosting } from "@/components/landing/SelfHosting";
import { Showcase } from "@/components/landing/Showcase";
import { SocialProof } from "@/components/landing/SocialProof";
import { FAQ, faqs } from "@/components/landing/FAQ";
import { CTA } from "@/components/landing/CTA";
import { SITE_URL, createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Gratonite Chat | Free, Open-Source Community Platform",
  description:
    "Gratonite Chat is a free, open-source community platform for friends, gaming communities, guilds, and study groups. Real-time chat, spatial voice, cosmetics, and an auction house with no ads or tracking.",
  path: "/",
  keywords: [
    "Gratonite",
    "Gratonite Chat",
    "open source community platform",
    "free open source chat",
    "chat app for friends",
    "gaming voice chat",
    "spatial voice chat",
    "community platform",
  ],
});

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Gratonite",
  operatingSystem: "Windows, macOS, Linux, Web",
  applicationCategory: "CommunicationApplication",
  description:
    "A free, open-source community platform with real-time chat, spatial voice, community cosmetics, and an auction house.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  url: SITE_URL,
  publisher: {
    "@id": `${SITE_URL}#organization`,
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Hero />
      <Features />
      <SelfHosting />
      <Showcase />
      <SocialProof />
      <FAQ />
      <CTA />
    </>
  );
}
