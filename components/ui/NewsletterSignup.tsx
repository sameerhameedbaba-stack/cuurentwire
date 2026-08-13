/**
 * The CurrentWire Brief — newsletter module.
 * No email provider is connected, so submission is cleanly disabled and the
 * module says so honestly rather than pretending to subscribe anyone.
 */
export function NewsletterSignup() {
  return (
    <section
      aria-labelledby="brief-heading"
      className="bg-ink-deep px-6 py-8 text-white dark:border dark:border-rule sm:px-8"
    >
      <h2 id="brief-heading" className="headline text-2xl text-white">
        The CurrentWire Brief
      </h2>
      <p className="mt-1.5 max-w-md text-sm text-white/70">
        The most important US and Canadian stories, once a day.
      </p>
      <form className="mt-4 flex max-w-md flex-col gap-2 sm:flex-row" aria-describedby="brief-note">
        <label htmlFor="brief-email" className="sr-only">
          Email address
        </label>
        <input
          id="brief-email"
          type="email"
          placeholder="you@example.com"
          disabled
          className="w-full border border-white/25 bg-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/40 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled
          className="shrink-0 bg-brand px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          Get the Brief
        </button>
      </form>
      <p id="brief-note" className="mt-2 text-xs text-white/50">
        Sign-ups open soon — email delivery is not yet configured.
      </p>
    </section>
  );
}
