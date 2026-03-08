import type { Metadata } from "next";
import { Space_Grotesk, Manrope } from "next/font/google";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  SITE_BRAND,
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo";
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
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_BRAND,
  title: {
    default: "Gratonite Chat | Free, Open-Source Discord Alternative",
    template: "%s | Gratonite Chat",
  },
  description: DEFAULT_DESCRIPTION,
  keywords: [
    "Gratonite",
    "Gratonite Chat",
    "Discord alternative",
    "open source Discord alternative",
    "free chat app",
    "spatial voice chat",
    "community chat app",
    "gaming community platform",
    "privacy-first chat app",
  ],
  category: "technology",
  creator: "Gratonite Labs",
  publisher: "Gratonite Labs",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: "Gratonite Chat | Free, Open-Source Discord Alternative",
    description: DEFAULT_DESCRIPTION,
    type: "website",
    locale: "en_US",
    siteName: SITE_NAME,
    url: SITE_URL,
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 512,
        height: 512,
        alt: "Gratonite Chat logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Gratonite Chat | Free, Open-Source Discord Alternative",
    description: DEFAULT_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
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
              "@id": `${SITE_URL}#organization`,
              name: SITE_NAME,
              alternateName: SITE_BRAND,
              url: SITE_URL,
              logo: DEFAULT_OG_IMAGE,
              description: DEFAULT_DESCRIPTION,
              sameAs: [
                "https://github.com/Gratonite-Labs",
                "https://github.com/CoodayeA/Gratonite",
              ],
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "@id": `${SITE_URL}#website`,
              url: SITE_URL,
              name: SITE_BRAND,
              alternateName: SITE_NAME,
              description: DEFAULT_DESCRIPTION,
              publisher: {
                "@id": `${SITE_URL}#organization`,
              },
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
