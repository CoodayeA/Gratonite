import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Create Your Gratonite Account",
  description: "Create a Gratonite account to join chat, voice, and community spaces.",
  path: "/signup/",
  noIndex: true,
});

export default function SignupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
