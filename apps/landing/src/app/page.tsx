import { Metadata } from "next";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { Showcase } from "@/components/landing/Showcase";
import { SocialProof } from "@/components/landing/SocialProof";
import { FAQ, faqs } from "@/components/landing/FAQ";
import { CTA } from "@/components/landing/CTA";

export const metadata: Metadata = {
  title: "Gratonite — Free, Open-Source Discord Alternative Built for Friends",
  description:
    "Gratonite is a free, open-source alternative to Discord. Real-time chat, spatial voice, cosmetics, and an auction house — built by friends, for friends. No ads, no tracking.",
};

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Gratonite",
  operatingSystem: "Windows, macOS, Linux, Web",
  applicationCategory: "CommunicationApplication",
  description:
    "A free, open-source Discord alternative with real-time chat, spatial voice, community cosmetics, and an auction house.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  url: "https://gratonite.chat",
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
      <Showcase />
      <SocialProof />
      <FAQ />
      <CTA />
    </>
  );
}
