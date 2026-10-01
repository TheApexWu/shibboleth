#!/bin/bash
# Addendum B: retry the run-2 chain after a crash. Every step resumes from its saved outputs, so a retry redoes only
# unfinished work. Third attempt: a checkpoint that still fails capture is left out and the result is marked INCOMPLETE.
V=~/rapture-run/validation/run2; cd $V
for attempt in 1 2 3; do
  rm -f STATUS
  [ $attempt = 3 ] && export ALLOW_INCOMPLETE=1
  echo "[$(date +%H:%M)] supervisor: attempt $attempt" >> chain.log
  ./finalize2.sh
  s=$(cat STATUS 2>/dev/null)
  case "$s" in DONE*) echo "[$(date +%H:%M)] supervisor: $s" >> chain.log; exit 0 ;; esac
  echo "[$(date +%H:%M)] supervisor: attempt $attempt ended with '${s:-no STATUS}'" >> chain.log
  sleep 120
done
echo "FAIL after 3 attempts: $s" > STATUS
