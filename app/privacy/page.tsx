import type { Metadata } from "next";
import { ProsePage } from "@/components/layout/ProsePage";
import { siteConfig } from "@/config/site";
import { pageMetadata } from "@/lib/seo/metadata";
import { TrustPageJsonLd } from "@/lib/seo/structured-data";

/** One string for <meta name="description"> and the WebPage JSON-LD. */
const DESCRIPTION =
  "How CurrentWire handles data: local storage, server logs, external links and your choices.";

export const metadata: Metadata = pageMetadata({
  title: "Privacy",
  description: DESCRIPTION,
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
        <li>
          <strong>Analytics cookies.</strong> Google Analytics sets
          first-party cookies (names starting with <code>_ga</code>) so that
          repeat visits are counted as one visitor instead of many. See the
          Analytics section below.
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
        CurrentWire uses <strong>Google Analytics 4</strong> to understand, in
        aggregate, which pages are read and where readers come from. It
        records pages viewed, approximate location (country/region derived
        from your network), and device and browser type. Google Analytics 4
        does not log or store individual IP addresses, and we have not
        enabled advertising features or Google Signals — the data is used
        only as anonymous, aggregate statistics about how the site is used.
      </p>
      <p>
        If you prefer not to be counted, standard tracker-blocking browser
        settings and extensions (or Google’s{" "}
        <a
          href="https://tools.google.com/dlpage/gaoptout"
          rel="noopener noreferrer"
        >
          opt-out add-on
        </a>
        ) stop this measurement, and the site works exactly the same without
        it.
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
      <TrustPageJsonLd
        path="/privacy"
        name="Privacy"
        description={DESCRIPTION}
      />
    </ProsePage>
  );
}
