import type { Metadata } from "next";
import { ProsePage } from "@/components/layout/ProsePage";
import { siteConfig } from "@/config/site";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Privacy",
  description: "How CurrentWire handles data: local storage, server logs, external links and your choices.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <ProsePage
      eyebrow="Legal"
      title="Privacy"
      intro="CurrentWire is built to work without accounts and without collecting personal profiles. This page describes what the site actually does."
    >
      <p className="text-sm text-muted">
        This description reflects the functionality currently implemented. It is
        provided for transparency and should receive professional legal review
        before any commercial launch.
      </p>

      <h2>What we store on your device</h2>
      <ul>
        <li>
          <strong>Theme preference.</strong> Your light/dark mode choice is
          saved in your browser’s local storage (key: <code>cw-theme</code>).
          It never leaves your device.
        </li>
      </ul>
      <p>
        CurrentWire does not set advertising or cross-site tracking cookies.
      </p>

      <h2>Server logs</h2>
      <p>
        Like virtually all websites, our servers record standard technical logs
        (requested pages, timestamps, status codes) to operate and secure the
        service. Logs are used for diagnostics, not profiling.
      </p>

      <h2>Analytics</h2>
      <p>
        No third-party analytics service is currently enabled. If aggregate,
        privacy-respecting usage measurement is added later, this page will be
        updated first.
      </p>

      <h2>External links</h2>
      <p>
        Story pages link to original reporting on publisher websites. Once you
        leave CurrentWire, the destination site’s own privacy practices apply.
      </p>

      <h2>Contact data</h2>
      <p>
        If you email us, we receive your address and message and use them only
        to respond. We do not add you to mailing lists. The newsletter module is
        currently disabled and collects nothing.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Clear your browser storage to remove the saved theme preference.</li>
        <li>
          Email{" "}
          <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>{" "}
          with any privacy question.
        </li>
      </ul>
    </ProsePage>
  );
}
