"use client";

import { Check, Link2, Mail, Share2 } from "lucide-react";
import { useState } from "react";

/**
 * Accessible share panel: copy link, native Web Share on supported devices,
 * and standard share intents (X, Facebook, LinkedIn, email).
 */
export function ShareActions({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const [canNativeShare] = useState(
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
  );

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — the intent links below still work.
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ url, title });
    } catch {
      // User dismissed the sheet — nothing to do.
    }
  }

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const intents = [
    { label: "Share on X", href: `https://x.com/intent/post?url=${encodedUrl}&text=${encodedTitle}`, text: "X" },
    { label: "Share on Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, text: "Facebook" },
    { label: "Share on LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`, text: "LinkedIn" },
  ];

  const buttonClass =
    "inline-flex items-center gap-1.5 border border-rule bg-surface px-3 py-1.5 text-xs font-semibold transition-colors hover:border-brand hover:text-brand-ink";

  return (
    <div className="no-print" role="group" aria-label="Share this story">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={copyLink} className={buttonClass}>
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-brand-ink" aria-hidden /> Copied
            </>
          ) : (
            <>
              <Link2 className="h-3.5 w-3.5" aria-hidden /> Copy link
            </>
          )}
        </button>
        {canNativeShare ? (
          <button type="button" onClick={nativeShare} className={buttonClass}>
            <Share2 className="h-3.5 w-3.5" aria-hidden /> Share
          </button>
        ) : null}
        {intents.map((intent) => (
          <a
            key={intent.text}
            href={intent.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={intent.label}
            className={buttonClass}
          >
            {intent.text}
          </a>
        ))}
        <a
          href={`mailto:?subject=${encodedTitle}&body=${encodedUrl}`}
          aria-label="Share by email"
          className={buttonClass}
        >
          <Mail className="h-3.5 w-3.5" aria-hidden /> Email
        </a>
      </div>
    </div>
  );
}
