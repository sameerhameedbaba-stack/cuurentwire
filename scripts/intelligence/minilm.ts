/**
 * Local embedding backend for the semantic shadow evaluations.
 *
 * Model: Xenova/all-MiniLM-L6-v2 (Apache-2.0, ~23 MB quantized ONNX) via
 * @xenova/transformers — runs fully locally in Node, no API, no account,
 * no cost. devDependency only: nothing here is bundled into the Next.js
 * production build; shadow evaluations run on a developer machine or CI.
 *
 * First call downloads the model to the local HF cache; subsequent runs are
 * offline.
 */

let extractorPromise: Promise<(texts: string[]) => Promise<number[][]>> | null = null;

async function getExtractor(): Promise<(texts: string[]) => Promise<number[][]>> {
  extractorPromise ??= (async () => {
    const { pipeline } = await import("@xenova/transformers");
    const pipe = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    return async (texts: string[]) => {
      const output = await pipe(texts, { pooling: "mean", normalize: true });
      // output.dims = [batch, 384]
      const [batch, dim] = output.dims as [number, number];
      const data = output.data as Float32Array;
      const vectors: number[][] = [];
      for (let i = 0; i < batch; i++) {
        vectors.push(Array.from(data.slice(i * dim, (i + 1) * dim)));
      }
      return vectors;
    };
  })();
  return extractorPromise;
}

export const MINILM_MODEL = "Xenova/all-MiniLM-L6-v2";

/** Embed texts in batches; vectors are L2-normalized (cosine = dot). */
export async function embedAll(
  texts: string[],
  batchSize = 32,
  onProgress?: (done: number, total: number) => void,
): Promise<number[][]> {
  const extractor = await getExtractor();
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const vectors = await extractor(texts.slice(i, i + batchSize));
    out.push(...vectors);
    onProgress?.(Math.min(i + batchSize, texts.length), texts.length);
  }
  return out;
}

/** Dot product of normalized vectors = cosine similarity. */
export function cosine(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}
