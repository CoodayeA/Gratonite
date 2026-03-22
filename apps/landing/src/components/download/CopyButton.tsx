"use client";

import { useState } from "react";
import { CopyIcon, CheckIcon } from "./icons";

interface CopyButtonProps {
  text: string;
  className?: string;
}

export function CopyButton({ text, className = "" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access denied
    }
  };

  return (
    <button
      onClick={handleCopy}
      aria-label="Copy command"
      className={`p-1.5 rounded-md hover:bg-foreground/10 transition-colors ${className}`}
    >
      {copied ? (
        <CheckIcon size={14} className="text-green-500" />
      ) : (
        <CopyIcon size={14} className="text-foreground/40" />
      )}
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied!" : ""}
      </span>
    </button>
  );
}
