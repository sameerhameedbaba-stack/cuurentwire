/**
 * Article briefs — the hand-off from the deterministic pipeline to the
 * writing step.
 *
 * WHY A BRIEF AND NOT THE ARTICLES THEMSELVES
 *
 * The owner chose original prose written from the facts, not a close rewrite
 * of what the sources published. That choice is enforced HERE, structurally,
 * rather than by asking a writer to behave. A brief deliberately carries:
 *
 *   - FACTS that two or more independent publications both state,
 *   - the source list, with how a reader can reach each one,
 *   - keyword targets backed by our own Search Console evidence,
 *   - the rules the finished piece must satisfy.
 *
 * It deliberately does NOT carry source article bodies. Nobody can rewrite
 * prose they were never given. Facts are not copyrightable; a publication's
 * expression of them is. Handing over only the former is what keeps this
 * lawful, and it is also what makes the output genuinely ours rather than a
 * laundered copy — which is the same thing Google's scaled-content policy is
 * looking for.
 *
 * A brief is data. It is built without a network call and is fully testable.
 */

import type { CategoryId } from "@/config/categories";
import { resolveAccess, resolveLicense, type SourceAccess, type SourceLicense } from "@/config/sources";
import { accessBreakdown, type EligibilityVerdict } from "@/lib/editorial/eligibility";
import { keywordTargets, primaryTarget, type GscQueryRow, type KeywordTarget } from "@/lib/editorial/keywords";
import { corroboratedDetails, isPressReleaseMember } from "@/lib/news/coverage-analysis";
import type { StoryCluster } from "@/lib/news/types";

export interface BriefSource {
  name: string;
  domain: string;
  url: string;
  access: SourceAccess;
  license?: SourceLicense;
  headline: string;
  publishedAt: string;
}

export interface BriefFact {
  /** The corroborated detail, as stated. */
  phrase: string;
  /** Publications whose reporting contains it. Always 2 or more. */
  confirmedBy: string[];
}

export interface ArticleBrief {
  clusterId: string;
  slug: string;
  category: CategoryId;
  /** The event, in our own words — the writer's starting point, not a headline to copy. */
  workingTitle: string;
  /** Facts at least two independent publications agree on. */
  facts: BriefFact[];
  /** Every independent publication backing the story. */
  sources: BriefSource[];
  /** Sources a reader can open without paying, by name. */
  readableSources: string[];
  keywords: KeywordTarget[];
  /** The phrase the headline should serve; undefined when evidence is too thin to force one. */
  headlineKeyword?: string;
  /** True when the owner must read this before it publishes. */
  reviewRequired: boolean;
  /** Why review is required, empty when it is not. */
  reviewReasons: string[];
  /** Hard rules the finished article must satisfy. */
  rules: string[];
  /** The AI-assistance disclosure that must appear on the published page. */
  disclosure: string;
}

/**
 * Disclosure text. The owner's recorded decision: AI-assistance disclosure on
 * every article, no fake human bylines. Kept as one constant so it cannot
 * drift between templates, and so changing it is a single visible edit.
 */
export const AI_DISCLOSURE =
  "This article was written with AI assistance from reporting by the " +
  "publications listed above, and reviewed against them before publication.";

/**
 * Rules that travel with every brief.
 *
 * These are instructions to the writing step, and they are phrased as hard
 * constraints because that is what they are. Two of them encode lessons this
 * project already paid for: the "sources" wording ban is a standing site rule
 * (PLAYBOOK.md), and the keyword rule exists because stuffing is the failure
 * mode that a keyword-led brief invites.
 */
export const WRITING_RULES: readonly string[] = [
  "Write original prose. You are given facts, not article text — never reproduce a source's phrasing.",
  "Every claim in the article must trace to a fact in this brief, or to something you can attribute in the same sentence.",
  "Attribute any accusation, allegation or disputed claim to the publication that made it, by name.",
  "Use each keyword target only where it reads naturally. If a phrase cannot sit in a sentence a person would write, drop it — a missing keyword costs one ranking, stuffing costs the domain.",
  "The headline must describe the story truthfully first and carry the keyword second. Never the reverse.",
  "Do not use the word 'sources' in story copy — write 'reports' or name the publications (standing site rule).",
  "Link every publication named, so a reader can check the account themselves.",
  "State plainly when reports disagree, rather than picking the tidier version.",
  "No invented quotes, numbers, dates or details. If the brief does not contain it, it does not go in.",
];

/** Independent (non-press-release) members, one per domain, best tier first. */
function independentSources(cluster: Pick<StoryCluster, "articles">): BriefSource[] {
  const seen = new Set<string>();
  const out: BriefSource[] = [];
  for (const article of cluster.articles) {
    if (isPressReleaseMember(article)) continue;
    const domain = article.sourceDomain.trim().toLowerCase();
    if (seen.has(domain)) continue;
    seen.add(domain);
    out.push({
      name: article.source,
      domain: article.sourceDomain,
      url: article.canonicalUrl || article.url,
      access: resolveAccess(article.source, article.sourceDomain),
      license: resolveLicense(article.source, article.sourceDomain),
      headline: article.title,
      publishedAt: article.publishedAt,
    });
  }
  return out;
}

export interface BuildBriefOptions {
  webQueries?: GscQueryRow[];
  strikingDistance?: GscQueryRow[];
  keywordLimit?: number;
}

/**
 * Build the brief for one selected story.
 *
 * @param cluster the story, already through the eligibility gate
 * @param verdict that gate's verdict — carried through so the brief states
 *                whether the owner must see this before it runs, rather than
 *                re-deriving it and risking a different answer
 */
export function buildBrief(
  cluster: StoryCluster,
  verdict: EligibilityVerdict,
  options: BuildBriefOptions = {},
): ArticleBrief {
  const { webQueries = [], strikingDistance = [], keywordLimit = 5 } = options;

  const facts: BriefFact[] = corroboratedDetails(cluster).map((detail) => ({
    phrase: detail.phrase,
    confirmedBy: detail.sources,
  }));

  const keywords = keywordTargets(cluster, webQueries, {
    limit: keywordLimit,
    strikingDistance,
  });

  const reviewReasons = verdict.autoPublish
    ? []
    : verdict.reasons.filter((reason) => reason.startsWith("sensitive-") || reason === "outside-launch-categories");

  return {
    clusterId: cluster.id,
    slug: cluster.slug,
    category: cluster.category,
    workingTitle: cluster.title,
    facts,
    sources: independentSources(cluster),
    readableSources: accessBreakdown(cluster).free,
    keywords,
    headlineKeyword: primaryTarget(keywords)?.phrase,
    reviewRequired: !verdict.autoPublish,
    reviewReasons,
    rules: [...WRITING_RULES],
    disclosure: AI_DISCLOSURE,
  };
}

/**
 * Render a brief as the Markdown a writing step actually reads.
 *
 * Markdown rather than raw JSON because this is also what the owner sees when
 * approving a held story — the review queue and the writing input are the
 * same artefact, so there is no second format to keep in sync.
 */
export function renderBrief(brief: ArticleBrief): string {
  const lines: string[] = [];
  lines.push(`# Brief: ${brief.workingTitle}`, "");
  lines.push(`- **Category:** ${brief.category}`);
  lines.push(`- **Slug:** ${brief.slug}`);
  if (brief.headlineKeyword) {
    lines.push(`- **Headline should serve:** "${brief.headlineKeyword}"`);
  } else {
    lines.push(`- **Headline should serve:** no keyword evidence — write the truest headline, do not force a phrase`);
  }
  if (brief.reviewRequired) {
    lines.push(`- **HOLD FOR OWNER APPROVAL:** ${brief.reviewReasons.join(", ")}`);
  }
  lines.push("");

  lines.push("## Facts confirmed by two or more publications", "");
  if (brief.facts.length === 0) {
    lines.push("_None extracted. Write only what you can attribute in-sentence._", "");
  } else {
    for (const fact of brief.facts) {
      lines.push(`- **${fact.phrase}** — confirmed by ${fact.confirmedBy.join(", ")}`);
    }
    lines.push("");
  }

  lines.push("## Publications reporting this", "");
  for (const source of brief.sources) {
    const access =
      source.access === "free" ? "free to read" : source.access === "metered" ? "metered" : "paywalled";
    const license = source.license ? `, ${source.license}` : "";
    lines.push(`- [${source.name}](${source.url}) — ${access}${license} — "${source.headline}"`);
  }
  lines.push("");
  lines.push(`Readers can open: ${brief.readableSources.join(", ") || "none"}.`, "");

  lines.push("## Keyword targets", "");
  if (brief.keywords.length === 0) {
    lines.push("_No keyword evidence for this story. Write it straight._", "");
  } else {
    for (const target of brief.keywords) {
      lines.push(`- **${target.phrase}** (${target.origin}) — ${target.rationale}`);
    }
    lines.push("");
  }

  lines.push("## Rules", "");
  for (const rule of brief.rules) lines.push(`- ${rule}`);
  lines.push("");
  lines.push("## Required disclosure", "", brief.disclosure, "");

  return lines.join("\n");
}
