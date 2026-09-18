import { Fragment, type ReactNode } from "react";
import { isSafeExternalUrl } from "@/lib/news/normalization/canonicalize";
import type { ArticleBlock } from "@/lib/editorial/article";

/**
 * Inline link syntax: `[text](url)`.
 *
 * Parsed into React nodes, never into HTML — there is no
 * `dangerouslySetInnerHTML` anywhere in this file, so a malformed or hostile
 * article body can produce wrong text but never markup. Anything that is not a
 * well-formed link renders as the literal characters the author typed.
 *
 * Only http(s) URLs that pass the site's existing external-URL check become
 * links; anything else (javascript:, data:, a relative path) renders as plain
 * text, because a link an author cannot verify is worse than no link.
 */
const INLINE_LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;

export function parseInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  // matchAll on a fresh regex each call — the /g lastIndex is not shared.
  for (const match of text.matchAll(INLINE_LINK)) {
    const [whole, label, href] = match;
    const start = match.index ?? 0;
    if (start > lastIndex) nodes.push(text.slice(lastIndex, start));

    if (isSafeExternalUrl(href)) {
      nodes.push(
        <a
          key={`l${key++}`}
          href={href}
          rel="nofollow noopener"
          target="_blank"
          className="underline underline-offset-2 hover:text-brand-ink"
        >
          {label}
        </a>,
      );
    } else {
      // Not a link we will vouch for: show what the author wrote, verbatim.
      nodes.push(whole);
    }
    lastIndex = start + whole.length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

/** Render an article's structured body. The renderer can only emit these tags. */
export function ArticleBody({ blocks }: { blocks: ArticleBlock[] }) {
  return (
    <>
      {blocks.map((block, index) => {
        switch (block.type) {
          case "heading":
            return (
              <h2
                key={index}
                className="headline mt-8 border-t border-rule pt-6 text-xl font-bold tracking-tight"
              >
                {block.text}
              </h2>
            );
          case "list":
            return (
              <ul key={index} className="mt-4 list-disc space-y-1.5 pl-5">
                {block.items.map((item, i) => (
                  <li key={i}>{parseInline(item)}</li>
                ))}
              </ul>
            );
          case "quote":
            return (
              <blockquote
                key={index}
                className="mt-6 border-l-4 border-rule-strong pl-4 italic"
              >
                <p>{parseInline(block.text)}</p>
                <footer className="mt-2 text-sm not-italic text-muted">
                  — {parseInline(block.attribution)}
                </footer>
              </blockquote>
            );
          case "paragraph":
          default:
            return (
              <p key={index} className="mt-4 leading-[1.7]">
                {parseInline(block.text)}
              </p>
            );
        }
      })}
    </>
  );
}

/** The source list a reader uses to check the account themselves. */
export function ArticleSources({
  sources,
}: {
  sources: { name: string; url: string; access: string; headline: string }[];
}) {
  return (
    <ul className="mt-4 space-y-3">
      {sources.map((source) => (
        <li key={source.url} className="text-sm">
          <a
            href={source.url}
            rel="nofollow noopener"
            target="_blank"
            className="font-semibold underline underline-offset-2 hover:text-brand-ink"
          >
            {source.name}
          </a>
          {source.access !== "free" ? (
            // Told plainly rather than discovered after the click.
            <span className="ml-2 rounded border border-rule px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-muted">
              {source.access === "paywalled" ? "subscription" : "may be metered"}
            </span>
          ) : null}
          <span className="mt-0.5 block text-muted">{source.headline}</span>
        </li>
      ))}
    </ul>
  );
}

/** Corrections, shown on the article itself where the error was made. */
export function ArticleCorrections({
  corrections,
}: {
  corrections: { date: string; text: string }[];
}) {
  if (corrections.length === 0) return null;
  return (
    <section className="mt-10 rounded border border-rule bg-surface-2 p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide">Corrections</h2>
      <ul className="mt-2 space-y-2 text-sm">
        {corrections.map((correction, i) => (
          <li key={i}>
            <Fragment>
              <time dateTime={correction.date} className="font-semibold">
                {correction.date}
              </time>
              {" — "}
              {parseInline(correction.text)}
            </Fragment>
          </li>
        ))}
      </ul>
    </section>
  );
}
