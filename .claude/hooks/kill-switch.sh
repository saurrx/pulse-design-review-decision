#!/usr/bin/env bash
# Halts every tool call while a file named AGENT_STOP exists at the repo root.
# Create it to pause an autonomous run; delete it to resume.
root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
if [ -f "$root/AGENT_STOP" ]; then
  echo "AGENT_STOP is present at $root. Halting until it is removed." >&2
  exit 2
fi
exit 0
