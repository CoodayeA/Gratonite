import type { Metadata } from "next";
import { Space_Grotesk, Manrope } from "next/font/google";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://gratonite.chat"),
  title: "Gratonite — Built by friends, for friends.",
  description:
    "Gratonite is a free, open-source Discord alternative for friends, guilds, and study groups. Real-time chat, voice, collectibles, cosmetics, and an auction house — no ads, no tracking.",
  openGraph: {
    title: "Gratonite — Built by friends, for friends.",
    description:
      "A free, open-source Discord alternative with real-time chat, spatial voice, cosmetics, and an auction house. Built by friends, for friends.",
    type: "website",
    siteName: "Gratonite",
    url: "https://gratonite.chat",
    images: [
      {
        url: "/Gratonite_logo.png",
        width: 512,
        height: 512,
        alt: "Gratonite Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Gratonite — Built by friends, for friends.",
    description:
      "A free, open-source Discord alternative with real-time chat, spatial voice, cosmetics, and an auction house.",
    images: ["/Gratonite_logo.png"],
  },
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/Gratonite_logo.png",
    apple: "/Gratonite_logo.png",
  },
};

// Inline script to prevent flash of wrong theme
const themeScript = `
  (function() {
    try {
      var theme = localStorage.getItem('theme');
      if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
      }
    } catch(e) {}
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Gratonite",
              url: "https://gratonite.chat",
              logo: "https://gratonite.chat/Gratonite_logo.png",
              sameAs: ["https://github.com/CoodayeA/Gratonite"],
            }),
          }}
        />
      </head>
      <body
        className={`${spaceGrotesk.variable} ${manrope.variable} antialiased grain-overlay`}
      >
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
