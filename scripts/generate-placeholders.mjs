import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Generates abstract editorial placeholder art (SVG) used by mock stories.
 * Deliberately graphic/geometric — never imitation news photography.
 */

const outDir = join(process.cwd(), "public", "placeholders");
mkdirSync(outDir, { recursive: true });

const palettes = {
  politics: ["#1f2937", "#C91920", "#94a3b8"],
  business: ["#0f2a43", "#C91920", "#7c93ab"],
  technology: ["#111827", "#C91920", "#64748b"],
  world: ["#1c2b2d", "#C91920", "#8aa0a3"],
  climate: ["#16302b", "#C91920", "#7fa39a"],
  health: ["#2b1f33", "#C91920", "#a191b0"],
  science: ["#101b3a", "#C91920", "#8b96bb"],
  culture: ["#332417", "#C91920", "#b09a82"],
  sports: ["#231f1f", "#C91920", "#9b8f8f"],
};

function svgFor(category, variant, [bg, accent, line]) {
  const seed = category.length * 7 + variant * 13;
  const shapes = [];
  for (let i = 0; i < 5; i++) {
    const x = ((seed * (i + 3) * 37) % 340) + 20;
    const y = ((seed * (i + 5) * 53) % 160) + 20;
    const r = ((seed * (i + 2) * 11) % 40) + 12;
    shapes.push(
      i % 2 === 0
        ? `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${line}" stroke-opacity="0.45" stroke-width="1.5"/>`
        : `<rect x="${x}" y="${y}" width="${r * 1.6}" height="${r * 1.6}" fill="none" stroke="${line}" stroke-opacity="0.35" stroke-width="1.5" transform="rotate(${(seed * i) % 40 - 20} ${x} ${y})"/>`,
    );
  }
  const barX = ((seed * 29) % 280) + 40;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 225" role="img" aria-label="Abstract editorial graphic">
  <rect width="400" height="225" fill="${bg}"/>
  <line x1="0" y1="${180 + (seed % 30)}" x2="400" y2="${40 + (seed % 50)}" stroke="${line}" stroke-opacity="0.5" stroke-width="1.5"/>
  <line x1="0" y1="${140 + (seed % 40)}" x2="400" y2="${(seed % 60)}" stroke="${line}" stroke-opacity="0.3" stroke-width="1"/>
  ${shapes.join("\n  ")}
  <rect x="${barX}" y="150" width="12" height="44" fill="${accent}"/>
  <rect x="${barX + 18}" y="166" width="12" height="28" fill="${accent}" opacity="0.55"/>
  <text x="24" y="200" font-family="Arial, sans-serif" font-size="13" font-weight="bold" letter-spacing="4" fill="#ffffff" opacity="0.55">${category.toUpperCase()}</text>
</svg>`;
}

let count = 0;
for (const [category, palette] of Object.entries(palettes)) {
  for (const variant of [1, 2, 3, 4]) {
    writeFileSync(
      join(outDir, `${category}-${variant}.svg`),
      svgFor(category, variant, palette),
    );
    count++;
  }
}
console.log(`Wrote ${count} placeholder SVGs to public/placeholders`);
