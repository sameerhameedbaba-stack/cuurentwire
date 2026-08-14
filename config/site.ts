/**
 * Centralized site configuration.
 * All branding, navigation and default SEO data lives here so the
 * brand can be replaced later without touching application code.
 */

export const siteConfig = {
  name: "CurrentWire",
  logoText: "CurrentWire",
  tagline: "The stories shaping the United States, Canada, and the world.",
  footerTagline: "Independent news discovery for the stories shaping North America.",
  domain: "currentwire.us",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  description:
    "CurrentWire continuously discovers, ranks and organizes the top 100 current news stories affecting the United States and Canada, with transparent attribution to original publishers.",
  contactEmail: process.env.CONTACT_EMAIL ?? "contact@currentwire.us",
  correctionsEmail: process.env.CORRECTIONS_EMAIL ?? "corrections@currentwire.us",
  publishersEmail: process.env.PUBLISHERS_EMAIL ?? "publishers@currentwire.us",
  social: {
    x: "https://x.com/currentwire",
    facebook: "https://facebook.com/currentwire",
    linkedin: "https://linkedin.com/company/currentwire",
    rss: "/rss",
  },
  colors: {
    primaryRed: "#C91920",
    deepCharcoal: "#151515",
    nearBlack: "#090909",
    offWhite: "#F7F7F5",
    canadaAccent: "#D52B1E",
    usaAccent: "#274690",
  },
  navigation: {
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
      ],
      explore: [
        { label: "Top 100", href: "/top-100" },
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
    defaultTitle: "CurrentWire — Top US & Canada News, Ranked",
    defaultDescription:
      "The top 100 current news stories across the United States and Canada, continuously refreshed, intelligently ranked, deduplicated and transparently attributed.",
    twitterHandle: "@currentwire",
  },
} as const;

export type SiteConfig = typeof siteConfig;
