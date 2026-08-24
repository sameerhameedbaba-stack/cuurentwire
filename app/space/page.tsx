import { createHubPage } from "@/components/hubs/HubPage";

// Topic hub — see config/hubs.ts. ISR like every section page.
// COST floor, not a freshness choice: every ISR re-render is billed
// (Vercel Hobby-tier blowout, 2026-08-24 — ISR Writes 238%, CPU 307%).
// Do not lower this to chase TTFB; the cron's targeted revalidation
// keeps content fresh. Quota math lives in seo/PLAYBOOK.md.
export const revalidate = 3600;

const hub = createHubPage("space");
export const generateMetadata = hub.generateMetadata;
export default hub.Page;
