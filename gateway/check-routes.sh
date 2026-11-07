#!/bin/sh
# Story 1.3: public routes must not expose internal mutation endpoints. Usage: gateway/check-routes.sh [base-url]
# Needs the stack running (docker compose up). Expect every BLOCKED line to be 403 and every OPEN line not to be.
G=${1:-http://localhost:8080}; fail=0
check() { # method path expect(403|open)
  code=$(curl -s -o /dev/null -w '%{http_code}' -X "$1" "$G$2")
  if { [ "$3" = 403 ] && [ "$code" = 403 ]; } || { [ "$3" = open ] && [ "$code" != 403 ]; }; then r=ok; else r=FAIL; fail=1; fi
  printf '%-4s %-6s %-40s %s\n' "$r" "$1" "$2" "$code"
}
for p in rainfall/ingest terrain/extract snapshots/create tiling; do check POST "/api/v1/gis/$p" 403; done
check POST /api/v1/ai/inference 403
check POST /api/v1/ai/forecasts 403
check GET  /api/v1/gis/rainfall/live open
check POST /api/v1/auth/login open
exit $fail
