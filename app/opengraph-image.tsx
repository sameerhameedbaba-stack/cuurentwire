import { ImageResponse } from "next/og";
import { siteConfig } from "@/config/site";

export const alt = `${siteConfig.name} — ${siteConfig.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** CurrentWire-branded social card: dark ground, red signal, wordmark. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#090909",
          padding: 72,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
          <div style={{ width: 14, height: 84, backgroundColor: "#C91920" }} />
          <div style={{ width: 14, height: 52, backgroundColor: "#C91920" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 96,
              fontWeight: 800,
              color: "#FFFFFF",
              letterSpacing: -4,
              display: "flex",
            }}
          >
            Current<span style={{ color: "#C91920" }}>Wire</span>
          </div>
          <div style={{ fontSize: 34, color: "#B9B9B4", marginTop: 16 }}>
            {siteConfig.tagline}
          </div>
        </div>
        <div
          style={{
            fontSize: 24,
            color: "#7C7C76",
            letterSpacing: 6,
            textTransform: "uppercase",
          }}
        >
          Top 100 stories · ranked · attributed
        </div>
      </div>
    ),
    size,
  );
}
