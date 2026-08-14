import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/layout/ProsePage";
import { siteConfig } from "@/config/site";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "CurrentWire News Desk",
  description:
    "What the automated CurrentWire News Desk is: how stories are compiled from publisher metadata, what it does and does not do, and how to reach us.",
  path: "/news-desk",
});

export default function NewsDeskPage() {
  return (
    <ProsePage
      eyebrow="Transparency"
      title="The CurrentWire News Desk"
      intro="Every story on CurrentWire carries the byline “Compiled by CurrentWire News Desk”. This page explains exactly what that byline means — and what it does not."
    >
      <h2>What the News Desk is</h2>
      <p>
        The CurrentWire News Desk is an <strong>automated compilation
        system</strong>, not a newsroom. It continuously collects reports from
        publisher RSS feeds and news APIs, groups reports about the same event
        into a single story, ranks those stories, and links every one of them
        back to the original reporting.
      </p>

      <h2>What it does</h2>
      <ul>
        <li>
          Compiles headlines and summaries strictly from the metadata
          publishers provide with their own feeds.
        </li>
        <li>
          Clusters duplicate reports of the same event into one story with
          transparent attribution to each publication.
        </li>
        <li>
          Ranks stories with a deterministic scoring system — see the{" "}
          <Link href="/methodology">methodology</Link> for the exact signals
          and weights.
        </li>
        <li>Links every story to the publishers&rsquo; original articles.</li>
      </ul>

      <h2>What it does not do</h2>
      <ul>
        <li>
          <strong>No human journalists:</strong> nobody at CurrentWire reports,
          writes or edits news stories.
        </li>
        <li>
          <strong>No AI-generated reporting:</strong> CurrentWire does not
          generate article text. Headlines and summaries are derived from
          publisher-provided metadata, never invented.
        </li>
        <li>
          <strong>No hosted articles:</strong> CurrentWire does not host
          article bodies. The journalism — and its copyright — belongs to the
          attributed publishers.
        </li>
      </ul>

      <h2>How ranking works</h2>
      <p>
        Stories are scored from 0 to 100 using freshness, source authority,
        breadth of coverage, geographic relevance, prominence and velocity.
        The full, current weighting is published on the{" "}
        <Link href="/methodology">methodology page</Link> and applies equally
        to every story — there is no editorial override.
      </p>

      <h2>Corrections</h2>
      <p>
        Automated systems make mistakes: a story can be mis-grouped,
        mis-categorized or mis-ranked. When that happens we want to know. The{" "}
        <Link href="/corrections">corrections process</Link> explains how to
        report an error and what happens next.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about the News Desk or this site? Use the{" "}
        <Link href="/contact">contact page</Link> or write to{" "}
        <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>.
        Publishers with feed or attribution questions can reach{" "}
        <a href={`mailto:${siteConfig.publishersEmail}`}>{siteConfig.publishersEmail}</a>.
      </p>
    </ProsePage>
  );
}
