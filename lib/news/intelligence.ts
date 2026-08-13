import { classifyCategory } from "@/lib/news/classification/category";
import { extractEntities } from "@/lib/news/classification/entities";
import { truncate } from "@/lib/utils/text";

/**
 * Optional intelligence abstraction.
 *
 * The platform never requires an LLM: the deterministic provider below powers
 * everything out of the box. A future AI-backed provider (summarization,
 * embedding-assisted clustering, richer entity extraction) can implement this
 * same interface and be swapped in via configuration — with the hard rule
 * that generated summaries must derive only from supplied source text and
 * must never introduce quotations, numbers or claims not present in it.
 */

export interface IntelligenceProvider {
  name: string;
  /** Summarize permitted source text. Must not invent information. */
  summarize(title: string, sourceText: string | undefined): Promise<string | undefined>;
  classify(title: string, description?: string): Promise<string>;
  extractEntities(title: string, description?: string): Promise<string[]>;
}

/** Deterministic fallback: no model calls, no invented content. */
export const deterministicIntelligence: IntelligenceProvider = {
  name: "deterministic",

  async summarize(_title, sourceText) {
    // With only metadata available, the honest summary is the source
    // description itself (trimmed) — or nothing at all.
    if (!sourceText || sourceText.trim().length < 20) return undefined;
    return truncate(sourceText.trim(), 320);
  },

  async classify(title, description) {
    return classifyCategory({ title, description }).primary;
  },

  async extractEntities(title, description) {
    return extractEntities(title, description);
  },
};

export function getIntelligenceProvider(): IntelligenceProvider {
  // Future: return an AI-backed provider when INTELLIGENCE_PROVIDER is set.
  return deterministicIntelligence;
}
