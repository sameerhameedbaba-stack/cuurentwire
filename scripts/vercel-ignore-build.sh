#!/usr/bin/env bash
#
# Vercel "Ignored Build Step" for CurrentWire.
#
# Contract (Vercel): exit 0 => SKIP the build, exit 1 => RUN the build.
# Any other exit code is treated as a project error and the deployment is
# marked "Build Failed" — which is exactly how this repo lost three days.
#
# THE OUTAGE THIS EXISTS TO PREVENT (2026-08-31 -> 2026-09-03).
# vercel.json used to run the diff inline:
#
#   git diff --quiet ${VERCEL_GIT_PREVIOUS_SHA:-HEAD^} HEAD -- . ':(exclude)seo' …
#
# VERCEL_GIT_PREVIOUS_SHA is the commit of the last SUCCESSFUL deployment, and
# Vercel builds from a shallow clone. Once that commit aged out of the clone
# depth, git answered `fatal: bad object f8805af…` and exited 128. Vercel read
# 128 as a build error, so the deployment failed — which meant the last
# successful deployment stayed f8805af, which meant the next deploy diffed
# against the same missing object. A self-locking deadlock: every deployment
# after 2026-08-31 21:39 UTC failed in 4-7 seconds without ever starting a
# build, while the site went on serving the f8805af bundle and every health
# check stayed green.
#
# The rule that prevents a repeat: this script may only ever exit 0 or 1, and
# when it cannot answer the question it must exit 1 (build). A needless build
# costs ISR writes; a wrongly skipped or crashed one costs shipping entirely.
#
# What it decides: skip the build when a commit range touched nothing outside
# seo/, docs/, data/, .github/ and top-level *.md. That is an ISR cost control
# (2026-08-24) — every deploy wipes the ISR cache and report commits land
# ~12x/day — and must not be dropped.
#
# THE SECOND RULE, AND WHY data/ IS NOT SIMPLY EXCLUDED (backlog 00b, fixed
# 2026-09-04). Three files under data/ are static imports compiled INTO the
# bundle, so excluding data/ wholesale meant their changes never reached
# production: the file changed on main and the site went on serving whatever
# copy the last unrelated build happened to compile. Measured before the fix,
# by running this script against real commits: 9ee4cc9, bf493b7 and 520caef
# — GSC reports that each rewrote data/gsc-url-signals.json, the file
# governing the thin-story noindex policy — all exited 0 = skip. The
# tombstone commit 593e369 shipped only because it happened to touch tests/
# as well; a tombstone commit touching only data/lost-stories.json would have
# left two URLs serving 500s to crawlers indefinitely.
#
# So the exclusions still decide the common case, and a change to one of the
# COMPILED_DATA_FILES below overrides them. Those three files changed 13 times
# between them in the 30 days to 2026-09-04, so this buys correctness for
# about one extra deploy a fortnight, not a new ISR bill.

set -u

# Vercel exposes the last successful deployment's commit here. Empty on a
# project's first-ever deployment.
BASE="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -z "$BASE" ]; then
  BASE="HEAD^"
fi

# Is the base commit actually present in this (shallow) clone? If not, we
# cannot compute the diff, so we build. This is the check whose absence caused
# the outage above.
if ! git cat-file -e "${BASE}^{commit}" 2>/dev/null; then
  echo "ignore-build: base commit '${BASE}' is not in this clone — building."
  exit 1
fi

# Files under data/ that are compiled into the bundle, so a change to one of
# them must deploy even though data/ is otherwise ignored. Kept on one line and
# in this exact form because tests/unit/deploy-watch-lib.test.ts parses it to
# prove the deploy watch's mirror has not drifted from this script.
COMPILED_DATA_FILES="data/gsc-url-signals.json data/lost-stories.json data/benchmark-history.json"

git diff --quiet "$BASE" HEAD -- . \
  ':(exclude)seo' \
  ':(exclude)docs' \
  ':(exclude)data' \
  ':(exclude).github' \
  ':(exclude)*.md'
code_status=$?

# Deliberate word splitting below: COMPILED_DATA_FILES is a list of paths.
# shellcheck disable=SC2086
git diff --quiet "$BASE" HEAD -- $COMPILED_DATA_FILES
data_status=$?

# Any code other than 0 or 1 means git could not answer. Never propagate it:
# Vercel would call it a build error and we would be back in the deadlock.
# When we cannot decide, we build.
if [ "$code_status" -gt 1 ] || [ "$data_status" -gt 1 ]; then
  echo "ignore-build: git diff failed (code ${code_status}, data ${data_status}) — building to be safe."
  exit 1
fi

if [ "$code_status" -eq 1 ]; then
  echo "ignore-build: code changed since ${BASE} — building."
  exit 1
fi

if [ "$data_status" -eq 1 ]; then
  echo "ignore-build: a compiled-in data file changed since ${BASE} — building."
  exit 1
fi

echo "ignore-build: no changes outside seo/docs/data/.github/*.md — skipping build."
exit 0
