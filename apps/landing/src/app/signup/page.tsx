"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.gratonite.chat";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const canSubmit = email.trim() && username.trim() && password && agreed && !loading;

  const handleRegister = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          username: username.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const code = data?.code || data?.message || "";
        if (code === "EMAIL_IN_USE") {
          setError("That email is already registered.");
        } else if (code === "USERNAME_TAKEN") {
          setError("That username is taken.");
        } else if (data?.details) {
          const firstErr = Object.values(data.details).flat()[0] as string;
          setError(firstErr || "Validation error.");
        } else {
          setError("Registration failed. Please try again.");
        }
        return;
      }

      setSuccess(true);
    } catch {
      setError("Could not connect to server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-28 relative overflow-hidden">
      <div className="neo-burst neo-burst-blue top-20 left-[-100px]" />
      <div className="neo-burst neo-burst-gold bottom-20 right-[-80px]" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-3 mb-10 group">
          <div className="w-12 h-12 neo-border rounded-xl overflow-hidden neo-shadow-sm">
            <Image
              src="/Gratonite_logo.png"
              alt="Gratonite"
              width={48}
              height={48}
              className="object-cover"
            />
          </div>
          <span className="font-display text-2xl font-bold tracking-tight">
            Gratonite
          </span>
        </Link>

        {/* Card */}
        <div className="bg-surface neo-border rounded-2xl p-8 neo-shadow">
          {success ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-green-500/10 border-2 border-green-500/30 flex items-center justify-center mx-auto mb-4">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h1 className="font-display text-2xl font-bold mb-2">Check your email</h1>
              <p className="text-foreground/50 text-sm mb-6">
                We sent a verification link to <strong>{email}</strong>. Click it to activate your account.
              </p>
              <Link
                href="/app/login"
                className="text-purple hover:text-purple-light font-bold text-sm transition-colors"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h1 className="font-display text-3xl font-bold text-center mb-2">
                Create account
              </h1>
              <p className="text-foreground/50 text-center text-sm mb-8">
                Join the Gratonite community
              </p>

              {error && (
                <div className="bg-red-500/10 border-2 border-red-500/30 rounded-lg px-4 py-3 mb-6 text-sm text-red-400 font-medium">
                  {error}
                </div>
              )}

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-foreground/70 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 rounded-lg neo-border-2 bg-background text-foreground placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-purple/50 transition-all text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-foreground/70 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Pick a username"
                    className="w-full px-4 py-3 rounded-lg neo-border-2 bg-background text-foreground placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-purple/50 transition-all text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-foreground/70 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleRegister()}
                      placeholder="Create a password"
                      className="w-full px-4 py-3 rounded-lg neo-border-2 bg-background text-foreground placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-purple/50 transition-all text-sm pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground/70 transition-colors cursor-pointer"
                    >
                      {showPw ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      )}
                    </button>
                  </div>
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-2 border-foreground/30 accent-purple cursor-pointer"
                  />
                  <span className="text-sm text-foreground/60">
                    I agree to the{" "}
                    <Link href="/safety" className="text-purple hover:text-purple-light font-medium">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link href="/safety" className="text-purple hover:text-purple-light font-medium">
                      Privacy Policy
                    </Link>
                  </span>
                </label>

                <button
                  type="button"
                  onClick={handleRegister}
                  disabled={!canSubmit}
                  className={`w-full py-3 rounded-lg font-display font-bold text-base neo-border transition-all cursor-pointer ${
                    !canSubmit
                      ? "bg-foreground/10 text-foreground/30 cursor-not-allowed"
                      : "bg-purple text-white neo-shadow neo-shadow-hover hover:bg-purple-light hover:rotate-[-1deg]"
                  }`}
                >
                  {loading ? "Creating account..." : "Create Account"}
                </button>
              </div>

              <div className="mt-8 pt-6 border-t-2 border-foreground/10 text-center">
                <p className="text-sm text-foreground/50">
                  Already have an account?{" "}
                  <Link
                    href="/app/login"
                    className="text-purple hover:text-purple-light font-bold transition-colors"
                  >
                    Sign in
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
