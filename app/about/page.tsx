import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/layout/ProsePage";
import { siteConfig } from "@/config/site";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "About",
  description:
    "CurrentWire helps readers understand what matters now across the United States and Canada.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <ProsePage
      eyebrow="CurrentWire"
      title="About CurrentWire"
      intro="CurrentWire helps readers understand what matters now across the United States and Canada."
    >
      <p>
        Hundreds of stories are published every hour. CurrentWire organizes
        reporting from established news organizations, identifies major
        developing stories and presents the most important coverage through a
        fast, clear and transparent news experience.
      </p>
      <p>
        CurrentWire is a news <strong>aggregator</strong>: stories are collected
        from publisher feeds and news APIs and compiled algorithmically. We
        employ no journalists and publish no AI-generated reporting — summaries
        come from the metadata publishers supply with their own feeds. Our{" "}
        <Link href="/methodology">methodology</Link> explains how this works.
      </p>
      <p>
        We do not aim to replace original journalism. We help readers discover
        it.
      </p>
      <p>
        CurrentWire attributes reporting to its original publishers and provides
        direct access to source coverage wherever possible. Every story page
        lists the publications covering it, when each report appeared, and links
        straight to the original reporting. CurrentWire links out — it does not
        host publisher article bodies.
      </p>
      <h2>What makes CurrentWire different</h2>
      <ul>
        <li>
          <strong>The Top 100.</strong> A continuously refreshed, transparently
          ranked list of the most important current stories affecting the
          United States and Canada — not just the newest ones.
        </li>
        <li>
          <strong>One story, all coverage.</strong> When many publications
          report the same event, CurrentWire groups that coverage into a single
          story so the picture is clear, not repetitive.
        </li>
        <li>
          <strong>Transparent ranking.</strong> Our{" "}
          <Link href="/methodology">methodology</Link> explains exactly which
          signals shape placement.
        </li>
      </ul>
      <h2>Who runs CurrentWire</h2>
      <p>
        CurrentWire ({siteConfig.domain}) is an independently operated news
        aggregation service. General enquiries:{" "}
        <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>.
        Corrections:{" "}
        <a href={`mailto:${siteConfig.correctionsEmail}`}>
          {siteConfig.correctionsEmail}
        </a>
        . Publishers:{" "}
        <a href={`mailto:${siteConfig.publishersEmail}`}>
          {siteConfig.publishersEmail}
        </a>
        .
      </p>
      <p>
        <em>Operator details: to be published.</em>
      </p>
      <h2>Contact</h2>
      <p>
        Questions, corrections and publisher enquiries:{" "}
        <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>{" "}
        — or see the <Link href="/contact">contact page</Link>.
      </p>
    </ProsePage>
  );
}
