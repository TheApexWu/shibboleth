#!/bin/bash
# Judge + analyze, but only while Ollama holds no model: the 4B judge (~12 GB) plus another job's
# qwen3:8b (~6 GB) overflows the 16 GB Mini and both crawl. Never touches Ollama or its callers.
V=~/rapture-run/validation; cd $V
OL=/Applications/Ollama.app/Contents/Resources/ollama
idle () { [ "$($OL ps 2>/dev/null | tail -n +2 | wc -l | tr -d ' ')" = "0" ]; }
until idle && sleep 120 && idle; do echo "[$(date +%H:%M)] waiting: ollama has a model loaded" >> finalize.log; sleep 300; done
echo "[$(date +%H:%M)] judge start (ollama idle)" >> finalize.log
/usr/bin/python3 judge.py >> finalize.log 2>&1 || { echo "FAIL judge (see finalize.log)" > FINAL_STATUS; exit 1; }
echo "[$(date +%H:%M)] analyze start" >> finalize.log
/usr/bin/python3 analyze.py > analyze.out 2>&1 || { echo "FAIL analyze (see analyze.out)" > FINAL_STATUS; exit 1; }
echo "DONE $(date +%H:%M)" > FINAL_STATUS
