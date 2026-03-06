import Link from "next/link";

const footerSections = [
  {
    title: "Product",
    links: [
      { label: "Download", href: "/download" },
      { label: "Discover", href: "/discover" },
      { label: "Pricing", href: "/pricing" },
      { label: "Why Gratonite", href: "/why-gratonite" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Blog", href: "/blog" },
      { label: "Safety", href: "/safety" },
      { label: "GitHub", href: "https://github.com/Gratonite-Labs" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Support", href: "/support" },
      { label: "Contact", href: "mailto:hello@gratonite.chat" },
      { label: "Bug Report", href: "mailto:bugs@gratonite.chat?subject=Bug%20Report" },
    ],
  },
];

function FooterLink({ href, label }: { href: string; label: string }) {
  const isExternal = href.startsWith("http");
  const isMail = href.startsWith("mailto:");

  if (isExternal || isMail) {
    return (
      <a
        href={href}
        className="text-white/70 hover:text-white transition-colors font-medium"
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noreferrer" : undefined}
      >
        {label}
      </a>
    );
  }

  return (
    <Link
      href={href}
      className="text-white/70 hover:text-white transition-colors font-medium"
    >
      {label}
    </Link>
  );
}

export function Footer() {
  return (
    <footer className="bg-charcoal text-white mt-24">
      <div className="max-w-7xl mx-auto px-6 py-16">
        {/* Big wordmark */}
        <div className="mb-16">
          <h2 className="font-display text-6xl md:text-8xl font-bold tracking-tight">
            Gratonite Labs.
          </h2>
          <p className="mt-4 text-lg text-white/60 max-w-md">
            Built by friends, for friends.
          </p>
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
          {footerSections.map((section) => (
            <div key={section.title}>
              <h3 className="font-display font-bold text-sm uppercase tracking-wider text-white/40 mb-4">
                {section.title}
              </h3>
              <ul className="space-y-3">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <FooterLink href={link.href} label={link.label} />
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Newsletter mini */}
          <div>
            <h3 className="font-display font-bold text-sm uppercase tracking-wider text-white/40 mb-4">
              Promise
            </h3>
            <p className="text-white/60 text-sm mb-3">
              Built to feel like a real hangout: no ads, no tracking, no
              microtransactions.
            </p>
            <a
              href="https://github.com/Gratonite-Labs"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors font-medium"
              aria-label="Gratonite Labs GitHub"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 .5a12 12 0 0 0-3.79 23.38c.6.11.82-.26.82-.58v-2.24c-3.34.73-4.04-1.41-4.04-1.41-.55-1.36-1.34-1.73-1.34-1.73-1.09-.74.08-.73.08-.73 1.2.09 1.83 1.2 1.83 1.2 1.07 1.79 2.8 1.27 3.48.97.11-.75.42-1.27.76-1.57-2.67-.3-5.48-1.31-5.48-5.84 0-1.29.47-2.35 1.24-3.18-.12-.3-.54-1.52.12-3.16 0 0 1.01-.32 3.3 1.21a11.62 11.62 0 0 1 6 0c2.29-1.53 3.3-1.21 3.3-1.21.66 1.64.24 2.86.12 3.16.77.83 1.24 1.89 1.24 3.18 0 4.54-2.81 5.53-5.49 5.83.43.37.81 1.09.81 2.2v3.27c0 .32.22.69.83.58A12 12 0 0 0 12 .5Z" />
              </svg>
              GitHub
            </a>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t-2 border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-white/40 text-sm">
            &copy; 2026 Gratonite Labs. Built by friends, for friends.
          </p>
          <div className="flex gap-6 text-white/40 text-sm">
            <Link href="/safety" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <Link href="/support" className="hover:text-white transition-colors">
              Support
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
