"use client";

import { useEffect } from "react";

export default function LoginPage() {
  useEffect(() => {
    window.location.href = "/app/login";
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-foreground/50">Redirecting to login...</p>
    </div>
  );
}
