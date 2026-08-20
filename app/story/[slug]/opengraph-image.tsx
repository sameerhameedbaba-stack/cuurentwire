import { ImageResponse } from "next/og";
import { CATEGORIES } from "@/config/categories";
import { siteConfig } from "@/config/site";
import {
  archivedStoryToCluster,
  findArchivedStory,
} from "@/lib/database/archive";
import { getClusterBySlug } from "@/lib/news/queries";
import { truncate } from "@/lib/utils/text";

export const dynamic = "force-dynamic";

export const alt = "CurrentWire story headline card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Branded per-story social card: headline, coverage count, category and
 * domain rendered as text on the CurrentWire ground. Publisher imagery is
 * NEVER embedded — copyright stays with the original publishers.
 */
export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Same resolution order as the page: live dataset, then the permanent
  // archive — a story that rotated out of the 72h window keeps its headline
  // card instead of degrading to the generic one.
  let cluster = await getClusterBySlug(slug).catch(() => null);
  if (!cluster) {
    const archived = await findArchivedStory(slug).catch(() => null);
    if (archived && !archived.mergedIntoClusterId) {
      cluster = archivedStoryToCluster(archived);
    }
  }

  // Generic branded fallback when the story is unknown or merged away.
  const headline = cluster ? truncate(cluster.title, 140) : siteConfig.tagline;
  const kicker = cluster ? CATEGORIES[cluster.category].label : "News discovery";
  const coverage = cluster
    ? `Coverage from ${cluster.sourceCount} ${cluster.sourceCount === 1 ? "source" : "sources"}`
    : "Top 100 stories · ranked · attributed";

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
          padding: 64,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* Pulse mark, dark-ground palette (2026-08 logo kit): 20u bars on
              13u gutters, heights 74/46/60, red terminal — scaled 0.72. */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 9 }}>
            <div style={{ width: 14, height: 53, backgroundColor: "#F7F7F5" }} />
            <div style={{ width: 14, height: 33, backgroundColor: "#F7F7F5" }} />
            <div style={{ width: 14, height: 43, backgroundColor: "#E0343B" }} />
          </div>
          <div
            style={{
              fontSize: 40,
              fontWeight: 800,
              color: "#FFFFFF",
              letterSpacing: -1,
              display: "flex",
            }}
          >
            Current<span style={{ color: "#E0343B" }}>Wire</span>
          </div>
          <div
            style={{
              fontSize: 26,
              color: "#E0343B",
              letterSpacing: 5,
              textTransform: "uppercase",
              marginLeft: "auto",
            }}
          >
            {kicker}
          </div>
        </div>
        <div
          style={{
            fontSize: headline.length > 90 ? 52 : 64,
            fontWeight: 800,
            color: "#FFFFFF",
            lineHeight: 1.15,
            letterSpacing: -1,
          }}
        >
          {headline}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 26,
            color: "#B9B9B4",
          }}
        >
          <div>{coverage}</div>
          <div style={{ color: "#7C7C76" }}>{siteConfig.domain}</div>
        </div>
      </div>
    ),
    size,
  );
}
