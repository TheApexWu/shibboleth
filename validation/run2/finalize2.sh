#!/bin/bash
# Run 2 chain. Each GPU step waits until Ollama holds no model (the CW crawl's qwen3:8b plus a judge overflows 16 GB).
# Resumable: each step skips work whose outputs exist. One status file per outcome.
# Addendum B: a saved output is trusted only if it loads, and the chain stops before judging unless every manifest
# checkpoint finished capture, so a crash retries the missing work instead of quietly shrinking the analysis.
V=~/rapture-run/validation/run2; cd $V; export PYTHONUNBUFFERED=1
OL=/Applications/Ollama.app/Contents/Resources/ollama
idle () { [ "$($OL ps 2>/dev/null | tail -n +2 | wc -l | tr -d ' ')" = "0" ]; }
gate () { until idle && sleep 90 && idle; do echo "[$(date +%H:%M)] waiting on ollama before $1" >> chain.log; sleep 300; done; }
step () { gate "$1"; echo "[$(date +%H:%M)] start $1" >> chain.log; /usr/bin/python3 $1.py >> chain.log 2>&1 || { echo "FAIL $1" > STATUS; exit 1; }; echo "[$(date +%H:%M)] done $1" >> chain.log; }
loads () { /usr/bin/python3 -c "import json,sys,torch; f=sys.argv[1]; json.load(open(f)) if f.endswith('.json') else torch.load(f, weights_only=False)" "$1" >/dev/null 2>&1; }
quarantine () { [ -f "$1" ] && ! loads "$1" && { echo "[$(date +%H:%M)] $1 does not load, set aside and redone" >> chain.log; mv "$1" "$1.bad-$(date +%s)"; }; }
quarantine filter.json;  [ -f filter.json ]  || step base_filter
quarantine base_run2.pt; [ -f base_run2.pt ] || step build_dirs
step capture2
MISSING=$(/usr/bin/python3 -c "import json,os; m=json.load(open('manifest2.json'))['checkpoints']; print(' '.join(e['name'] for e in m if not os.path.exists(os.path.join('capture2', e['name'], 'done.json'))))")
if [ -n "$MISSING" ]; then
  echo "[$(date +%H:%M)] capture incomplete: $MISSING" >> chain.log
  [ -n "$ALLOW_INCOMPLETE" ] || { echo "FAIL capture2 incomplete: $MISSING" > STATUS; exit 1; }
fi
until grep -q RUN2_DL_DONE ~/rapture-run/dl_run2.log; do sleep 120; done
step judges2
step analyze2
echo "DONE $(date +%H:%M)${MISSING:+ INCOMPLETE, missing: $MISSING}" > STATUS
