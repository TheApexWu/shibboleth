#!/bin/bash
# Re-run capture until every manifest checkpoint has a clean meta.json, picking up downloads as they land.
cd ~/rapture-run/validation
for i in $(seq 1 60); do
  /usr/bin/python3 capture.py 2>&1 | grep -v -iE "warn|NotOpenSSL|urllib3|deprecated|generation flags"
  left=$(/usr/bin/python3 -c 'import json,os
m=json.load(open("manifest.json"))["checkpoints"]
def ok(e):
    p="capture/%s/meta.json"%e["name"]
    return os.path.exists(p) and "error" not in json.load(open(p))
print(sum(not ok(e) for e in m))')
  echo "[$(date +%H:%M)] pass $i: $left left"
  [ "$left" = "0" ] && { echo "ALL_CAPTURED $(date +%H:%M)"; break; }
  if ! pgrep -f dl_0928 >/dev/null; then n_err=$(grep -l '"error"' capture/*/meta.json 2>/dev/null | wc -l); [ "$n_err" -gt 0 ] && echo "downloads done, $n_err checkpoint(s) errored; stopping"; [ "$n_err" -gt 0 ] && break; fi
  sleep 180
done
