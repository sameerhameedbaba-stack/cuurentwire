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
# What it decides, unchanged from the inline version: skip the build when a
# commit range touched nothing outside seo/, docs/, data/, .github/ and
# top-level *.md. That is an ISR cost control (2026-08-24) — every deploy wipes
# the ISR cache and report commits land ~12x/day — and must not be dropped.
# Known gap, tracked as backlog 00b: three files under data/ ARE compiled into
# the bundle, so their changes never deploy.

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

git diff --quiet "$BASE" HEAD -- . \
  ':(exclude)seo' \
  ':(exclude)docs' \
  ':(exclude)data' \
  ':(exclude).github' \
  ':(exclude)*.md'
status=$?

case "$status" in
  0)
    echo "ignore-build: no changes outside seo/docs/data/.github/*.md — skipping build."
    exit 0
    ;;
  1)
    echo "ignore-build: code changed since ${BASE} — building."
    exit 1
    ;;
  *)
    # git failed for some third reason. Never propagate its exit code: Vercel
    # would call it a build error and we would be back in the deadlock.
    echo "ignore-build: git diff failed (exit ${status}) — building to be safe."
    exit 1
    ;;
esac
