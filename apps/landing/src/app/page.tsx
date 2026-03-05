import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { Showcase } from "@/components/landing/Showcase";
import { SocialProof } from "@/components/landing/SocialProof";
import { FAQ } from "@/components/landing/FAQ";
import { CTA } from "@/components/landing/CTA";

export default function Home() {
  return (
    <>
      <Hero />
      <Features />
      <Showcase />
      <SocialProof />
      <FAQ />
      <CTA />
    </>
  );
}
