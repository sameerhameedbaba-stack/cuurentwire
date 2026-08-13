import Link from "next/link";
import { CATEGORIES, type CategoryId } from "@/config/categories";
import { ArticleRow, HeroStory, RankedStory, StandardStory } from "@/components/news/cards";
import { LastUpdated } from "@/components/news/LastUpdated";
import { SectionHeader } from "@/components/news/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { getCountryData } from "@/lib/news/queries";
import { BreadcrumbJsonLd, ItemListJsonLd } from "@/lib/seo/structured-data";

/** Shared implementation for the /us and /canada country hubs. */
export async function CountryPage({
  country,
  title,
  subheading,
  path,
  accent,
}: {
  country: "us" | "canada";
  title: string;
  subheading: string;
  path: string;
  accent: "us" | "canada";
}) {
  const data = await getCountryData(country);

  if (!data.hero) {
    return (
      <div className="mx-auto max-w-[1360px] px-4 py-16 sm:px-6">
        <EmptyState
          title={`No recent ${title} stories`}
          message="Check Latest for newly published coverage."
        />
      </div>
    );
  }

  const accentBorder = accent === "canada" ? "border-canada" : "border-usa";

  return (
    <div className="mx-auto max-w-[1360px] px-4 py-8 sm:px-6">
      <BreadcrumbJsonLd items={[{ name: "Home", path: "/" }, { name: title, path }]} />
      <ItemListJsonLd clusters={data.topList} path={path} name={`Top ${title} stories`} />

      <header className={`border-b-2 pb-5 ${accentBorder}`}>
        <h1 className="headline text-3xl sm:text-5xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">{subheading}</p>
        <div className="mt-3">
          <LastUpdated generatedAt={data.dataset.generatedAt} />
        </div>
      </header>

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-12">
        {/* Lead + supporting */}
        <div className="lg:col-span-8">
          <HeroStory cluster={data.hero} />
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {data.secondary.map((cluster) => (
              <StandardStory key={cluster.id} cluster={cluster} showImage />
            ))}
          </div>

          {/* Category sub-sections */}
          {(Object.entries(data.byCategory) as [CategoryId, typeof data.topList][]).map(
            ([categoryId, clusters]) => (
              <section key={categoryId} aria-label={CATEGORIES[categoryId].label} className="mt-12">
                <SectionHeader
                  title={CATEGORIES[categoryId].label}
                  href={CATEGORIES[categoryId].path}
                />
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                  {clusters.map((cluster) => (
                    <StandardStory key={cluster.id} cluster={cluster} />
                  ))}
                </div>
              </section>
            ),
          )}
        </div>

        {/* Rail: latest + top list */}
        <aside className="lg:col-span-4 lg:border-l lg:border-rule lg:pl-8">
          <section aria-label={`Latest ${title} developments`}>
            <SectionHeader title="Latest developments" href={`/latest?country=${country}`} />
            <div>
              {data.latest.slice(0, 6).map((article) => (
                <ArticleRow key={article.id} article={article} />
              ))}
            </div>
          </section>

          <section aria-label={`Top ${title} stories`} className="mt-10">
            <SectionHeader title={`Top ${title} stories`} />
            <ol>
              {data.topList.slice(0, 6).map((cluster, index) => (
                <li key={cluster.id}>
                  <RankedStory cluster={cluster} rank={index + 1} showThumbnail={false} />
                </li>
              ))}
            </ol>
            <Link
              href={`/top-100?country=${country}`}
              className="mt-4 inline-block text-sm font-bold text-brand-ink hover:underline"
            >
              Full ranked list →
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
