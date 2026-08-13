/** Shared shell for editorial/legal pages: measure, hierarchy, typography. */
export function ProsePage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[760px] px-4 py-10 sm:px-6">
      <header className="border-b-2 border-ink pb-6 dark:border-rule-strong">
        {eyebrow ? (
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-ink">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="headline mt-1 text-3xl sm:text-4xl">{title}</h1>
        {intro ? (
          <p className="mt-3 text-base leading-relaxed text-muted sm:text-lg">
            {intro}
          </p>
        ) : null}
      </header>
      <div className="prose-cw mt-8 space-y-5 text-[1.0625rem] leading-[1.7] [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:mt-8 [&_h2]:border-t [&_h2]:border-rule [&_h2]:pt-6 [&_h3]:font-display [&_h3]:text-base [&_h3]:font-bold [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-brand-ink [&_p+p]:mt-4">
        {children}
      </div>
    </div>
  );
}
