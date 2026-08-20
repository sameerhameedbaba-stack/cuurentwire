import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * iOS home-screen icon: the Pulse mark (2026-08 logo kit) on the dark tile.
 * Kit proportions — mark box 60% of tile, bars 20u wide on 13u gutters,
 * shared baseline, heights 74/46/60 — scaled to 180px (1u ≈ 1.08px).
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#111111",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
          <div style={{ width: 22, height: 80, backgroundColor: "#F7F7F5" }} />
          <div style={{ width: 22, height: 50, backgroundColor: "#F7F7F5" }} />
          <div style={{ width: 22, height: 65, backgroundColor: "#E0343B" }} />
        </div>
      </div>
    ),
    size,
  );
}
