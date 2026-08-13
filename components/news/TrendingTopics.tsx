import Link from "next/link";
import { TrendingUp } from "lucide-react";
import type { TrendingTopic } from "@/lib/news/types";

/** Trending topics strip — derived from live article frequency, never hardcoded. */
export function TrendingTopics({ topics }: { topics: TrendingTopic[] }) {
  if (topics.length === 0) return null;
  return (
    <nav aria-label="Trending topics" className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-brand-ink">
        <TrendingUp className="h-3.5 w-3.5" aria-hidden />
        Trending
      </span>
      <ul className="flex flex-wrap items-center gap-1.5">
        {topics.map((topic) => (
          <li key={topic.slug}>
            <Link
              href={`/topic/${topic.slug}`}
              className="block rounded-full border border-rule bg-surface px-3 py-1 text-xs font-semibold text-ink transition-colors hover:border-brand hover:text-brand-ink"
            >
              {topic.topic}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
