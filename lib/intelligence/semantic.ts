import { createHash } from "node:crypto";
import { CATEGORY_IDS, type CategoryId } from "@/config/categories";
import type { CategoryResult } from "@/lib/news/classification/category";

/**
 * Intelligence Layer v2 — semantic fallback architecture.
 *
 * Layer 1 stays the deterministic engine (classifiers + lexical clustering).
 * The semantic layer defined here handles ONLY the ambiguous minority:
 *
 *   article → deterministic engine → confident? → accept
 *                                  → ambiguous? → semantic provider → decision
 *
 * Hard rules, enforced by this module and its tests:
 *  - a semantic failure (timeout, invalid output, budget exhaustion, no
 *    provider) ALWAYS falls back to the deterministic result — semantic
 *    problems can never crash ingestion or change availability;
 *  - semantic output is strictly typed: only known category ids, only known
 *    event relationships; anything else is rejected as a provider failure;
 *  - overrides are gated by configurable confidence thresholds, with
 *    "general is better than confidently wrong" as the default posture;
 *  - every result carries provider/model/version metadata for debugging;
 *  - budgets cap calls per refresh so a noisy news cycle cannot generate
 *    unbounded model usage.
 *
 * Rollout modes (SEMANTIC_MODE): "off" (default — deterministic only),
 * "shadow" (semantic runs and is recorded, never changes output),
 * "guarded" (general→specific overrides and evidence-backed merges only).
 * Production wiring stays OFF until shadow-mode evidence supports it.
 */

/** Version stamps persisted with every semantic result (§35/§36). */
export const INTELLIGENCE_VERSIONS = {
  classifierVersion: "det-cat-5",
  clusteringVersion: "det-cluster-4",
  gateVersion: "gate-1",
} as const;

export type SemanticMode = "off" | "shadow" | "guarded";

export interface SemanticConfig {
  mode: SemanticMode;
  /** Semantic category may replace a deterministic result at or above this. */
  categoryOverrideThreshold: number;
  /** Event merges require same_event at or above this. */
  mergeThreshold: number;
  maxClassificationsPerRefresh: number;
  maxComparisonsPerRefresh: number;
  timeoutMs: number;
}

export function semanticConfig(env: NodeJS.ProcessEnv = process.env): SemanticConfig {
  const mode = env.SEMANTIC_MODE;
  return {
    mode: mode === "shadow" || mode === "guarded" ? mode : "off",
    categoryOverrideThreshold: numberFrom(env.SEMANTIC_CATEGORY_OVERRIDE_THRESHOLD, 0.85),
    mergeThreshold: numberFrom(env.SEMANTIC_MERGE_THRESHOLD, 0.9),
    maxClassificationsPerRefresh: numberFrom(env.MAX_SEMANTIC_CLASSIFICATIONS_PER_REFRESH, 60),
    maxComparisonsPerRefresh: numberFrom(env.MAX_SEMANTIC_COMPARISONS_PER_REFRESH, 120),
    timeoutMs: numberFrom(env.SEMANTIC_TIMEOUT_MS, 4000),
  };
}

function numberFrom(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// ── Strictly typed semantic results ──────────────────────────────────────

export interface SemanticCategoryResult {
  category: CategoryId;
  /** 0..1 */
  confidence: number;
  /** Concise machine-readable reason — never model chain-of-thought. */
  reasonCode: string;
  provider: string;
  model: string;
}

export type EventRelationship = "same_event" | "related_event" | "different_event";

export interface EventRelationshipResult {
  relationship: EventRelationship;
  confidence: number;
  reasonCode: string;
  provider: string;
  model: string;
}

export interface SemanticCategoryInput {
  title: string;
  description?: string;
  source?: string;
  entities?: string[];
  geography?: string;
  /** Deterministic scores, for providers that can use them. */
  deterministicScores?: Partial<Record<CategoryId, number>>;
}

export interface SemanticEventInput {
  id: string;
  title: string;
  description?: string;
  entities?: string[];
  publishedAt?: string;
}

export interface SemanticProvider {
  name: string;
  model: string;
  classifyCategory(input: SemanticCategoryInput): Promise<SemanticCategoryResult | null>;
  compareEvents(
    a: SemanticEventInput,
    b: SemanticEventInput,
  ): Promise<EventRelationshipResult | null>;
}

/** Reject anything outside the allowed category set (§7). */
export function isValidSemanticCategory(value: string): value is CategoryId {
  return (CATEGORY_IDS as readonly string[]).includes(value);
}

const RELATIONSHIPS: EventRelationship[] = ["same_event", "related_event", "different_event"];

export function isValidRelationship(value: string): value is EventRelationship {
  return (RELATIONSHIPS as string[]).includes(value);
}

// ── Ambiguity gates (§6/§10) — pure and unit-tested ─────────────────────

/** Deterministic-confidence bar below which a specific category is doubted. */
export const GATE_LOW_CONFIDENCE = 0.4;
/** Top-two score margin (relative) below which the choice is a coin flip. */
export const GATE_CLOSE_MARGIN = 0.25;

/**
 * Should this article's category consult the semantic layer?
 * True when the deterministic engine said general, was low-confidence, or
 * had a near-tie between its top two categories.
 */
export function needsSemanticCategory(result: CategoryResult): boolean {
  if (result.primary === "general") return true;
  if (result.confidence < GATE_LOW_CONFIDENCE) return true;
  const scores = Object.values(result.scores).sort((a, b) => b - a);
  if (scores.length >= 2 && scores[0] > 0) {
    const margin = (scores[0] - scores[1]) / scores[0];
    if (margin < GATE_CLOSE_MARGIN) return true;
  }
  return false;
}

/**
 * Final category decision (§9/§39): semantic may replace GENERAL when its
 * confidence clears the override threshold; in guarded mode it never
 * overrides a specific deterministic category (that is Phase 3). Returns
 * the category to use plus whether an override happened.
 */
export function resolveCategory(
  deterministic: CategoryResult,
  semantic: SemanticCategoryResult | null,
  config: SemanticConfig,
): { category: CategoryId; overridden: boolean } {
  if (
    semantic &&
    deterministic.primary === "general" &&
    isValidSemanticCategory(semantic.category) &&
    semantic.category !== "general" &&
    semantic.confidence >= config.categoryOverrideThreshold
  ) {
    return { category: semantic.category, overridden: true };
  }
  return { category: deterministic.primary, overridden: false };
}

/**
 * Merge decision for the ambiguous clustering zone (§13/§41): semantic
 * same_event at/above the merge threshold AND at least one deterministic
 * evidence signal (shared rare stem / entity — supplied by the caller).
 * Semantic-only blind merges are not allowed.
 */
export function resolveMerge(
  semantic: EventRelationshipResult | null,
  hasDeterministicEvidence: boolean,
  config: SemanticConfig,
): boolean {
  return Boolean(
    semantic &&
      semantic.relationship === "same_event" &&
      semantic.confidence >= config.mergeThreshold &&
      hasDeterministicEvidence,
  );
}

// ── Guards: timeout, budget, telemetry (§19/§21/§22) ────────────────────

export interface SemanticTelemetry {
  categoryCalls: number;
  eventCalls: number;
  cacheHits: number;
  cacheMisses: number;
  providerFailures: number;
  timeouts: number;
  budgetExhausted: number;
}

export function emptyTelemetry(): SemanticTelemetry {
  return {
    categoryCalls: 0,
    eventCalls: 0,
    cacheHits: 0,
    cacheMisses: 0,
    providerFailures: 0,
    timeouts: 0,
    budgetExhausted: 0,
  };
}

/** Per-refresh call budget. Exhaustion is a silent deterministic fallback. */
export class SemanticBudget {
  private classifications = 0;
  private comparisons = 0;
  constructor(private readonly config: SemanticConfig) {}

  takeClassification(): boolean {
    if (this.classifications >= this.config.maxClassificationsPerRefresh) return false;
    this.classifications++;
    return true;
  }

  takeComparison(): boolean {
    if (this.comparisons >= this.config.maxComparisonsPerRefresh) return false;
    this.comparisons++;
    return true;
  }
}

/**
 * Run a provider call with a hard timeout. Every failure mode (throw,
 * timeout, null) resolves to null — the caller keeps the deterministic
 * result. Never throws.
 */
export async function withGuards<T>(
  call: () => Promise<T | null>,
  timeoutMs: number,
  telemetry: SemanticTelemetry,
): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      call(),
      new Promise<"__timeout__">((resolve) => {
        timer = setTimeout(() => resolve("__timeout__"), timeoutMs);
      }),
    ]);
    if (result === "__timeout__") {
      telemetry.timeouts++;
      return null;
    }
    return result;
  } catch {
    telemetry.providerFailures++;
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ── Deterministic cache keys (§20) ──────────────────────────────────────

export function categoryCacheKey(input: SemanticCategoryInput): string {
  return `cat:${sha256(`${input.title}\n${input.description ?? ""}`)}`;
}

export function eventCacheKey(a: SemanticEventInput, b: SemanticEventInput): string {
  const [first, second] = [a.id, b.id].sort();
  return `evt:${sha256(`${first}+${second}`)}`;
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf-8").digest("hex").slice(0, 24);
}

/** Provider that abstains from everything — the configured default. */
export const nullSemanticProvider: SemanticProvider = {
  name: "null",
  model: "none",
  async classifyCategory() {
    return null;
  },
  async compareEvents() {
    return null;
  },
};
