/** Route-level skeleton mirroring the homepage layout — no spinners. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1360px] px-4 py-8 sm:px-6" aria-busy="true" aria-label="Loading news">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-8">
          <div className="skeleton aspect-[16/9] w-full" />
          <div className="skeleton mt-5 h-4 w-24" />
          <div className="skeleton mt-3 h-10 w-full" />
          <div className="skeleton mt-2 h-10 w-4/5" />
          <div className="skeleton mt-4 h-4 w-2/3" />
        </div>
        <div className="lg:col-span-4">
          <div className="skeleton h-6 w-40" />
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="mt-5 flex gap-3">
              <div className="skeleton h-24 w-24 shrink-0" />
              <div className="flex-1">
                <div className="skeleton h-3 w-16" />
                <div className="skeleton mt-2 h-5 w-full" />
                <div className="skeleton mt-1.5 h-5 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i}>
            <div className="skeleton aspect-[3/2] w-full" />
            <div className="skeleton mt-3 h-3 w-20" />
            <div className="skeleton mt-2 h-5 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
