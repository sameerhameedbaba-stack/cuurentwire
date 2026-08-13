/**
 * Future advertising slot. No provider is configured today, so this renders
 * nothing — it never occupies blank space and never imitates a news story.
 * Wire a provider by branching on location and returning labeled ad markup.
 */
export function AdSlot(props: { location: string }) {
  const adProviderConfigured = false;
  if (!adProviderConfigured) return null;
  return <div data-ad-location={props.location} aria-label="Advertisement" />;
}
