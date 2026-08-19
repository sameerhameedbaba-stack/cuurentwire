One-line: "There is no resizing path" was written after auditing OUR
infrastructure only — every publisher CDN serving an oversized image had a
free, unsigned delivery-width parameter, and six curl probes found them.

Details: the 2026-08-19 backlog closed the homepage-LCP item with a careful,
correct-sounding argument: CBS's `/thumbnail/<size>/<hex>/` segment signs
exactly one rendition so the size cannot be swapped, and `next.config.ts` sets
`images.unoptimized` because the Vercel optimizer's free tier is ~5K
transformations/month and its wildcard `remotePatterns` made `/_next/image` an
open proxy. Both facts were verified and both are still true. The conclusion
drawn from them — "no resizing path exists" — was false, because both facts are
about *our* side of the request.

What actually worked, found by fetching one URL per host with six candidate
query shapes (`?width=`, `?w=`, `?imwidth=`, `?fit=`, `?d=`, `?resize=`):

- `assets*.cbsnewsstatic.com` honours `?width=976&quality=80` **on the
  original** — 4,085 KB / 4896x3264 -> 200 KB / 976x651. The signature binds
  the thumbnail rendition, not the CDN's whole resizing ability.
- `npr.brightspotcdn.com` is an unsigned Brightspot dims3 endpoint whose whole
  filter chain is editable: `/resize/7559x5039!/` -> `/resize/976x651!/
  quality/80/` took 6,366 KB to 84 KB.
- WordPress hosts (`platform.theverge.com`, `globalnews.ca`, `thehill.com`)
  take `&w=`: 607 KB -> 99 KB.
- `static.politico.com` genuinely has none — all six shapes returned the
  identical 4,944,055 bytes. Record the negative result too, with the byte
  count, so nobody re-probes it.

Rules this leaves behind:

- **A constraint proven on your own infrastructure is not a constraint on the
  request.** Before writing "no lever exists", spend one curl per third party.
  The probe cost about two minutes and moved `/top-100` from 28,171 KB to
  1,933 KB.
- **Verify an image rule on bytes AND decoded pixel dimensions.** A CDN that
  ignores an unknown parameter returns 200 with the original bytes, which looks
  like success in a status-code check and like a 95% win in a naive
  before/after if you compare the wrong pair. Reading the JPEG SOF/PNG IHDR
  header is a few lines and makes the check honest.
- **Keep the publisher's own choice when they made one.** The Hill ships
  `?w=900`; forcing our 976 would have fetched *more* bytes. Fill the gap, do
  not overwrite the intent.
- **Some assets have no lever at all and the answer is omission.** A live 6,221
  KB uncompressed `.bmp` is not resizable by any WordPress endpoint. Dropping
  the image costs a large-thumbnail slot and ~0.35 of ranking score; shipping it
  costs the LCP outright.
- **Scope a new gate to what someone can actually fix.** The health check fails
  on capped hosts over 500 KB (a broken rewrite rule) but only *reports*
  oversized images from hosts with no lever — same reasoning as the
  cried-wolf canonical check in
  [[2026-08-19-declared-config-is-not-applied-config]].

Related: [[2026-08-19-review-the-design-before-you-ship-it]] — the design that
read well and was wrong. This is the same failure one level up: an *analysis*
that read well and was wrong, and only a fetch could tell.
