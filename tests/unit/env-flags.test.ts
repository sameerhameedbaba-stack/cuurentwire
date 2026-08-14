import { afterEach, describe, expect, it } from "vitest";
import { env } from "@/lib/env";

/**
 * Feature-flag getters read process.env lazily (no memoization), so each
 * access reflects the current environment — the same guarantee the RSS
 * feed-health tests rely on for RSS_FEEDS.
 */
describe("env.newsletterEnabled", () => {
  const original = process.env.NEWSLETTER_SIGNUP;

  afterEach(() => {
    if (original === undefined) delete process.env.NEWSLETTER_SIGNUP;
    else process.env.NEWSLETTER_SIGNUP = original;
  });

  it("defaults off when NEWSLETTER_SIGNUP is unset", () => {
    delete process.env.NEWSLETTER_SIGNUP;
    expect(env.newsletterEnabled).toBe(false);
  });

  it('is on only for the exact value "on"', () => {
    process.env.NEWSLETTER_SIGNUP = "on";
    expect(env.newsletterEnabled).toBe(true);
    process.env.NEWSLETTER_SIGNUP = "true";
    expect(env.newsletterEnabled).toBe(false);
    process.env.NEWSLETTER_SIGNUP = "ON";
    expect(env.newsletterEnabled).toBe(false);
  });
});
