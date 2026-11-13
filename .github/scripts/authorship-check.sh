#!/usr/bin/env bash
# Every commit in a range lists only the repo owner as its human author.
#
# Usage: authorship-check.sh <base-sha> <head-sha>   (checks base..head)
#
# A local hook binds only the sessions that run it, and a guard that rejects
# AI identities only passes a fabricated human-looking one. So this repo, which
# one person owns, also allowlists the owner:
#   - every author is the owner;
#   - every committer is the owner or GitHub (a merge made on github.com).
#
# The message checks are the usual AI-marker ones, anchored to trailers and footers
# so a commit that quotes the markers while describing this policy still passes.
# The workflow runs this script; run it locally with the same two shas.
set -euo pipefail

BASE="${1:?usage: authorship-check.sh <base-sha> <head-sha>}"
HEAD="${2:?usage: authorship-check.sh <base-sha> <head-sha>}"
OWNER='gudrodur@gmail.com'
AI='Claude|Anthropic|Copilot|GPT|OpenAI|Gemini'
failed=0

while IFS='|' read -r sha an ae cn ce; do
  [ -n "$sha" ] || continue
  if [ "$ae" != "$OWNER" ]; then
    echo "::error::$sha is authored by $an <$ae>, not the owner"
    failed=1
  fi
  case "$ce" in
    "$OWNER" | noreply@github.com) ;;
    *)
      echo "::error::$sha is committed by $cn <$ce>, neither the owner nor GitHub"
      failed=1
      ;;
  esac
  for field in "$an <$ae>" "$cn <$ce>"; do
    if printf '%s' "$field" | grep -qiE "$AI|noreply@anthropic\.com"; then
      echo "::error::$sha is attributed to an AI identity: $field"
      failed=1
    fi
  done
done < <(git log --format='%H|%an|%ae|%cn|%ce' "$BASE..$HEAD")

while read -r sha; do
  [ -n "$sha" ] || continue
  trailers=$(git log -1 --format='%(trailers:only,unfold)' "$sha")
  if printf '%s' "$trailers" | grep -qiE "^Co-Authored-By:.*($AI)"; then
    echo "::error::$sha has an AI Co-Authored-By trailer"
    failed=1
  fi
  if printf '%s' "$trailers" | grep -qiE "^Claude-Session:|^[A-Za-z-]+:[[:space:]]*https://claude\.ai/"; then
    echo "::error::$sha references a Claude session"
    failed=1
  fi
  msg=$(git log -1 --format=%B "$sha")
  if printf '%s' "$msg" | grep -qiE "^[[:space:]]*(🤖[[:space:]]*)?Generated (with|by).*($AI)|^[[:space:]]*🤖"; then
    echo "::error::$sha has a generated-with footer"
    failed=1
  fi
done < <(git log --format='%H' "$BASE..$HEAD")

if [ "$failed" -ne 0 ]; then
  echo "Commits list only the owner as author. Rewrite the offending commits" \
       "(git commit --amend --reset-author, or a rebase) and force-push the branch."
  exit 1
fi
echo "✓ every commit in the range is the owner's, with no AI attribution"
