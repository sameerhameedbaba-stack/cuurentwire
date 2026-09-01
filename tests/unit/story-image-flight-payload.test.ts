import { isValidElement, type ReactElement } from "react";
import { describe, expect, it } from "vitest";

import { CategoryPlaceholder, StoryImage } from "@/components/news/StoryImage";

/**
 * Guards the RSC flight-payload cost of the story image.
 *
 * Every prop a Server Component hands to a Client Component is serialized into
 * the flight payload embedded in the HTML and parsed on the main thread during
 * hydration. `RemoteImage` is a Client Component, and it used to receive its
 * dead-image placeholder as an already-rendered `ReactNode`. Measured on
 * production 2026-09-02: 28 copies of a ~1,045-byte SVG element tree in the
 * homepage HTML to render exactly ONE of them; 25 copies each on `/top-100`
 * and `/most-covered` rendering none; 6.6% of all document bytes across nine
 * sampled pages.
 *
 * The e2e suite cannot catch a regression here: without a news API key the
 * dev server it drives serves fixture stories whose art is all LOCAL
 * placeholder SVG, so `RemoteImage` never renders and the payload assertion
 * passes trivially. This test drives the remote branch directly instead.
 */

/** Walk a returned element tree, collecting every element and its props. */
function collect(node: unknown, out: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(node)) {
    for (const child of node) collect(child, out);
    return out;
  }
  if (!isValidElement(node)) return out;
  out.push(node);
  const props = node.props as { children?: unknown };
  if (props && props.children !== undefined) collect(props.children, out);
  return out;
}

describe("StoryImage flight-payload cost", () => {
  const remote = {
    src: "https://images.example.com/photo.jpg",
    alt: "A headline",
    category: "business",
  } as const;

  it("hands the client component a label, never rendered placeholder art", () => {
    const tree = collect(StoryImage({ ...remote }));
    const clientImage = tree.find((el) => typeof el.type === "function");
    expect(clientImage, "expected a RemoteImage element for a remote src").toBeDefined();

    const props = clientImage!.props as Record<string, unknown>;
    expect(props.fallbackLabel).toBe("Business");
    expect(typeof props.fallbackLabel).toBe("string");
  });

  it("passes no React element as a prop to the client component", () => {
    const tree = collect(StoryImage({ ...remote }));
    const clientImage = tree.find((el) => typeof el.type === "function");
    const props = clientImage!.props as Record<string, unknown>;

    // `children` would be legitimate; any OTHER element-valued prop is a
    // subtree serialized into the payload for every image on the page.
    for (const [name, value] of Object.entries(props)) {
      if (name === "children") continue;
      expect(
        isValidElement(value),
        `prop "${name}" is a React element — it will be serialized into the ` +
          `flight payload on every image; pass a plain value instead`,
      ).toBe(false);
    }
  });

  /** Labels carried by any element in the tree (the art takes `label`). */
  const labelsIn = (node: unknown) =>
    collect(node)
      .map((el) => (el.props as { label?: unknown }).label)
      .filter((label): label is string => typeof label === "string");

  it("still shows the placeholder when a story has no image", () => {
    // No src: the placeholder is rendered on the SERVER, so it costs markup
    // once and no client prop at all.
    const tree = collect(StoryImage({ alt: "No art", category: "sports" }));
    const categories = tree.map((el) => (el.props as { category?: unknown }).category);
    expect(categories).toContain("sports");
  });

  it("keeps CategoryPlaceholder resolving its own label", () => {
    expect(labelsIn(CategoryPlaceholder({ category: "technology" })))
      .toContain("Technology");
  });
});
