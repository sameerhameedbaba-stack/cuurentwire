import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iOS home-screen icon: the CurrentWire wire-bars mark on the dark ground. */
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
          backgroundColor: "#090909",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
          <div style={{ width: 20, height: 96, backgroundColor: "#C91920" }} />
          <div style={{ width: 20, height: 62, backgroundColor: "#C91920" }} />
          <div
            style={{
              fontSize: 96,
              fontWeight: 800,
              color: "#FFFFFF",
              fontFamily: "Arial, sans-serif",
              marginLeft: 6,
            }}
          >
            C
          </div>
        </div>
      </div>
    ),
    size,
  );
}
