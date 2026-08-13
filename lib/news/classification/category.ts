import { CATEGORIES, CATEGORY_IDS, type CategoryId } from "@/config/categories";

/**
 * Deterministic keyword-scored category classifier.
 * Title matches weigh more than description matches; an exact provider
 * category alias is a strong signal but never the only one.
 */

export interface CategoryInput {
  title: string;
  description?: string;
  providerCategory?: string;
}

export interface CategoryResult {
  primary: CategoryId;
  all: CategoryId[];
}

export function classifyCategory(input: CategoryInput): CategoryResult {
  const title = ` ${input.title.toLowerCase()} `;
  const description = ` ${(input.description ?? "").toLowerCase()} `;
  const providerCategory = input.providerCategory?.toLowerCase().trim();

  const scores = new Map<CategoryId, number>();

  for (const id of CATEGORY_IDS) {
    const def = CATEGORIES[id];
    let score = 0;
    for (const keyword of def.keywords) {
      if (title.includes(keyword)) score += 3;
      else if (description.includes(keyword)) score += 1;
    }
    if (providerCategory && def.providerAliases.includes(providerCategory)) {
      score += 4;
    }
    if (score > 0) scores.set(id, score);
  }

  if (scores.size === 0) {
    // Nothing matched — provider alias alone, else world as the neutral bucket.
    if (providerCategory) {
      for (const id of CATEGORY_IDS) {
        if (CATEGORIES[id].providerAliases.includes(providerCategory)) {
          return { primary: id, all: [id] };
        }
      }
    }
    return { primary: "world", all: ["world"] };
  }

  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const primary = sorted[0][0];
  const threshold = Math.max(3, sorted[0][1] * 0.4);
  const all = sorted.filter(([, s]) => s >= threshold).map(([id]) => id);
  if (!all.includes(primary)) all.unshift(primary);
  return { primary, all: all.slice(0, 3) };
}
