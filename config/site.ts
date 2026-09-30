/**
 * Centralized site configuration.
 * All branding, navigation and default SEO data lives here so the
 * brand can be replaced later without touching application code.
 */

import { IS_STATIC_SITE } from "@/lib/site-mode";

/**
 * Navigation for the static site (production since 2026-09-28).
 *
 * Only pages that EXIST in the static build appear here. The aggregator's
 * sections (/latest, /us, /top-100, /search …) are not built for GitHub Pages,
 * so linking them would put a 404 in every page's chrome. The three categories
 * are the launch verticals (lib/editorial/eligibility.ts LAUNCH_CATEGORIES);
 * widening them is an owner decision, and this list should widen with them.
 */
const STATIC_NAVIGATION = {
  primary: [
    { label: "Home", href: "/" },
    { label: "Articles", href: "/articles" },
    { label: "Technology", href: "/technology" },
    { label: "Business", href: "/business" },
    { label: "Science", href: "/science" },
    { label: "About", href: "/about" },
  ],
  footer: {
    news: [
      { label: "Technology", href: "/technology" },
      { label: "Business", href: "/business" },
      { label: "Science", href: "/science" },
    ],
    explore: [
      { label: "All articles", href: "/articles" },
      { label: "RSS feed", href: "/rss.xml" },
    ],
    company: [
      { label: "About", href: "/about" },
      { label: "News Desk", href: "/news-desk" },
      { label: "Editorial Standards", href: "/editorial-standards" },
      { label: "Corrections", href: "/corrections" },
      { label: "Contact", href: "/contact" },
    ],
    legal: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Copyright", href: "/copyright" },
    ],
  },
};

export const siteConfig = {
  name: "CurrentWire",
  logoText: "CurrentWire",
  tagline: "The stories shaping the United States, Canada, and the world.",
  footerTagline: "Independent news discovery for the stories shaping North America.",
  domain: "currentwire.us",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  description: IS_STATIC_SITE
    ? "CurrentWire publishes a small number of original news articles each day, each written from reporting by two or more independent publications that readers can open and check."
    : "CurrentWire continuously discovers, ranks and organizes the top 100 current news stories affecting the United States and Canada, with transparent attribution to original publishers.",
  contactEmail: process.env.CONTACT_EMAIL ?? "contact@currentwire.us",
  correctionsEmail: process.env.CORRECTIONS_EMAIL ?? "corrections@currentwire.us",
  publishersEmail: process.env.PUBLISHERS_EMAIL ?? "publishers@currentwire.us",
  // Only profiles that actually exist belong here. No x/facebook/linkedin
  // entries: the three placeholder handles that used to sit here were all verified
  // wrong on 2026-09-03 (seo/offpage/LEDGER.md). x.com/currentwire is a
  // stranger's dormant account, facebook.com/currentwire redirects to an
  // unrelated profile, and the LinkedIn page 404s. Add entries here only
  // once a profile actually exists, and update `sameAs` in the same change.
  // Bluesky (created 2026-08-31, auto-posts top stories) is verified live and
  // is the one profile currently carried into `sameAs`.
  social: {
    rss: IS_STATIC_SITE ? "/rss.xml" : "/rss",
    bluesky: "https://bsky.app/profile/currentwire.bsky.social",
  },
  colors: {
    primaryRed: "#C91920",
    deepCharcoal: "#151515",
    nearBlack: "#090909",
    offWhite: "#F7F7F5",
    canadaAccent: "#D52B1E",
    usaAccent: "#274690",
  },
  navigation: IS_STATIC_SITE ? STATIC_NAVIGATION : {
    primary: [
      { label: "Home", href: "/" },
      { label: "Latest", href: "/latest" },
      { label: "United States", href: "/us" },
      { label: "Canada", href: "/canada" },
      { label: "Politics", href: "/politics" },
      { label: "Business", href: "/business" },
      { label: "Technology", href: "/technology" },
      { label: "World", href: "/world" },
      { label: "Climate", href: "/climate" },
      { label: "Health", href: "/health" },
      { label: "Science", href: "/science" },
      { label: "Culture", href: "/culture" },
      { label: "Sports", href: "/sports" },
    ],
    footer: {
      news: [
        { label: "Latest", href: "/latest" },
        { label: "United States", href: "/us" },
        { label: "Canada", href: "/canada" },
        { label: "Politics", href: "/politics" },
        { label: "Business", href: "/business" },
        { label: "Technology", href: "/technology" },
        { label: "World", href: "/world" },
        { label: "AI", href: "/ai" },
        { label: "Elections 2026", href: "/elections" },
      ],
      explore: [
        { label: "Articles", href: "/articles" },
        { label: "Daily Briefing", href: "/briefing" },
        { label: "Top 10 Today", href: "/top-10" },
        { label: "Top 100", href: "/top-100" },
        { label: "Most Covered", href: "/most-covered" },
        { label: "Media Coverage Report", href: "/reports/media-coverage" },
        { label: "Topics", href: "/topics" },
        { label: "Sources", href: "/sources" },
        { label: "Search", href: "/search" },
      ],
      company: [
        { label: "About", href: "/about" },
        { label: "News Desk", href: "/news-desk" },
        { label: "Methodology", href: "/methodology" },
        { label: "Editorial Standards", href: "/editorial-standards" },
        { label: "Corrections", href: "/corrections" },
        { label: "Contact", href: "/contact" },
      ],
      legal: [
        { label: "Privacy", href: "/privacy" },
        { label: "Terms", href: "/terms" },
        { label: "Copyright", href: "/copyright" },
      ],
    },
  },
  seo: {
    titleTemplate: "%s | CurrentWire",
    // Search-phrased (seo/STRATEGY.md Sprint 1): "top news today" is how the
    // homepage's nearest page-1 queries are typed; the brand stays at the end
    // so the "currentwire" navigational query still matches.
    defaultTitle: IS_STATIC_SITE
      ? "CurrentWire — Original News, Checked Against Multiple Reports"
      : "Top News Today — US & Canada Headlines, Ranked | CurrentWire",
    defaultDescription: IS_STATIC_SITE
      ? "Original technology, business and science news, each article written from two or more independent reports you can open and check yourself."
      : "The top 100 current news stories across the United States and Canada, continuously refreshed, intelligently ranked, deduplicated and transparently attributed.",
  },
} as const;

export type SiteConfig = typeof siteConfig;
