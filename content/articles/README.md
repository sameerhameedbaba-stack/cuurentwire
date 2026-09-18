# Published articles

One JSON file per article, validated by `publishedArticleSchema`
(`lib/editorial/article.ts`) and read at BUILD time by `lib/editorial/store.ts`.
Every article page is therefore fully static: no database read, no ISR write,
nothing billed per view. That is what keeps the site inside the free Hobby
caps the old aggregator blew through.

## How a file gets here

The daily routine selects a story, builds a brief, writes the article from the
brief's facts, and commits the file. Publishing is a deploy — the diff is the
review surface.

## Rules the schema enforces (not suggestions)

- at least 2 independent publications, by distinct domain;
- at least 2 of them free to read — the "free range" rule;
- a quote must carry an attribution;
- `status: "draft"` is ignored by the loader, so unfinished or
  owner-held pieces can sit here with no risk of being built;
- slugs are unique; two files claiming one slug fails both, loudly.

An article that breaks these cannot load, so it cannot build, so it cannot
ship. Do not "fix" a failing article by relaxing the schema.

## Shape

```json
{
  "slug": "kebab-case-slug",
  "title": "Headline, truthful first and keyword second",
  "dek": "One sentence of standfirst under the headline.",
  "category": "technology",
  "status": "published",
  "publishedAt": "2026-09-18T09:00:00.000Z",
  "body": [
    { "type": "paragraph", "text": "Prose, with [an attribution link](https://example.com) inline." },
    { "type": "heading", "text": "A subhead" },
    { "type": "list", "items": ["one", "two"] },
    { "type": "quote", "text": "A quotation.", "attribution": "Name, reported by Publication" }
  ],
  "sources": [
    { "name": "Associated Press", "url": "https://apnews.com/…", "access": "free", "headline": "Their headline" }
  ],
  "keywordsTargeted": ["phrase the piece was built around"],
  "clusterId": "optional — traces the article back to its brief",
  "corrections": []
}
```

Inline links use `[text](url)` and are parsed into React nodes, never into
HTML. Anything else in that position renders as plain text.
