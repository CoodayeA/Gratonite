"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const navLinks = [
  { href: "/download", label: "Download" },
  { href: "/deploy", label: "Self-Host" },
  { href: "/federation", label: "Federation" },
  { href: "/safety", label: "Safety" },
  { href: "/support", label: "Support" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!navRef.current || !innerRef.current) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const trigger = ScrollTrigger.create({
      start: 'top -100',
      end: '+=99999',
      onUpdate: (self) => {
        const scrolled = self.progress > 0;
        gsap.to(innerRef.current, {
          paddingTop: scrolled ? '0.5rem' : '1rem',
          paddingBottom: scrolled ? '0.5rem' : '1rem',
          duration: 0.3,
          ease: 'power2.out',
        });
      },
    });
    return () => trigger.kill();
  }, []);

  return (
    <nav ref={navRef} className="fixed top-0 w-full z-50 backdrop-blur-sm" style={{ background: "var(--nav-bg)", borderBottom: "3px solid var(--neo-border-color)" }}>
      <div ref={innerRef} className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 neo-border rounded-lg overflow-hidden neo-shadow-sm">
            <Image
              src="/Gratonite_logo.png"
              alt="Gratonite"
              width={40}
              height={40}
              className="object-cover"
            />
          </div>
          <span className="font-display text-xl font-bold tracking-tight">
            Gratonite
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-medium text-foreground/70 hover:text-foreground transition-colors relative group"
            >
              {link.label}
              <span className="absolute -bottom-1 left-0 w-0 h-[3px] bg-purple group-hover:w-full transition-all duration-300" />
            </Link>
          ))}
        </div>

        {/* Right side — toggle + CTA */}
        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/app/login"
            className="font-display font-bold text-sm px-4 py-2 rounded-lg border-2 border-foreground/20 hover:border-foreground/40 text-foreground/80 hover:text-foreground transition-all duration-200"
          >
            Log In
          </Link>
          <Button variant="secondary" size="sm" href="/download">
            Get the App
          </Button>
        </div>

        {/* Mobile — toggle + hamburger */}
        <div className="flex md:hidden items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="w-10 h-10 neo-border-2 rounded-lg flex flex-col items-center justify-center gap-1.5 bg-surface neo-shadow-sm cursor-pointer"
            aria-label="Toggle menu"
          >
            <span
              className={`w-5 h-0.5 bg-foreground transition-all duration-300 ${
                mobileOpen ? "rotate-45 translate-y-2" : ""
              }`}
            />
            <span
              className={`w-5 h-0.5 bg-foreground transition-all duration-300 ${
                mobileOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`w-5 h-0.5 bg-foreground transition-all duration-300 ${
                mobileOpen ? "-rotate-45 -translate-y-2" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-surface px-6 py-6 flex flex-col gap-4" style={{ borderTop: "3px solid var(--neo-border-color)" }}>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="font-display text-lg font-bold py-2 border-b-2 border-foreground/10"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/app/login"
            onClick={() => setMobileOpen(false)}
            className="font-display text-lg font-bold py-2 border-b-2 border-foreground/10 text-purple"
          >
            Log In
          </Link>
          <Button variant="secondary" size="md" href="/download">
            Get the App
          </Button>
        </div>
      )}
    </nav>
  );
}
