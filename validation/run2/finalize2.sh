#!/bin/bash
# Run 2 chain. Each GPU step waits until Ollama holds no model (the CW crawl's qwen3:8b plus a judge overflows 16 GB).
# Resumable: each step skips work whose outputs exist. One status file per outcome.
V=~/rapture-run/validation/run2; cd $V; export PYTHONUNBUFFERED=1
OL=/Applications/Ollama.app/Contents/Resources/ollama
idle () { [ "$($OL ps 2>/dev/null | tail -n +2 | wc -l | tr -d ' ')" = "0" ]; }
gate () { until idle && sleep 90 && idle; do echo "[$(date +%H:%M)] waiting on ollama before $1" >> chain.log; sleep 300; done; }
step () { gate "$1"; echo "[$(date +%H:%M)] start $1" >> chain.log; /usr/bin/python3 $1.py >> chain.log 2>&1 || { echo "FAIL $1" > STATUS; exit 1; }; echo "[$(date +%H:%M)] done $1" >> chain.log; }
[ -f filter.json ] || step base_filter
[ -f base_run2.pt ] || step build_dirs
step capture2
until grep -q RUN2_DL_DONE ~/rapture-run/dl_run2.log; do sleep 120; done
step judges2
step analyze2
echo "DONE $(date +%H:%M)" > STATUS
