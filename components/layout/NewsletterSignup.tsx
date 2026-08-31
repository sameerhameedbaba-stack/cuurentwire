/**
 * Daily-briefing signup — a plain HTML form posting straight to
 * Buttondown's hosted endpoint for the `currentwire` newsletter
 * (buttondown.com/currentwire, login support@currentwire.us). No client
 * JS, and no subscriber data ever touches this site: Buttondown
 * double-opt-ins every address and hosts the confirmation page.
 * Styled for the dark footer ground it ships in.
 */
export function NewsletterSignup() {
  return (
    <form
      action="https://buttondown.com/api/emails/embed-subscribe/currentwire"
      method="post"
      className="mt-6"
    >
      <label
        htmlFor="footer-newsletter-email"
        className="text-xs font-bold uppercase tracking-[0.14em] text-white/50"
      >
        Daily briefing by email
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="footer-newsletter-email"
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          autoComplete="email"
          className="w-full min-w-0 rounded-sm border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/60 focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 rounded-sm bg-[#e0343b] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#c91920]"
        >
          Subscribe
        </button>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-white/45">
        The day&apos;s top US &amp; Canada stories, once a day. Unsubscribe
        anytime.
      </p>
      <input type="hidden" name="embed" value="1" />
    </form>
  );
}
