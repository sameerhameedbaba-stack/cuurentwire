One-line: The claude-seo plugin marketplace isn't reachable from this environment — the SEO loop runs on built-in tools (curl crawls, keyless PSI API, JSON-LD parsing) and loses nothing.

Details: Prompt pack Step 1 asked to install AgriciDaniel/claude-seo and extensions.
Plugin catalog search returned no results in this workspace, and interactive
`/plugin` dialogs are unavailable in automated sessions. Everything the plugin
would provide (audits, CWV, schema checks) is done directly: curl for raw
HTML/XML, PageSpeed Insights keyless API for CWV, node for JSON-LD validation.
Do not retry plugin installation on every run; revisit only if the workspace
catalog gains an SEO plugin.
