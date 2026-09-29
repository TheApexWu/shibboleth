import json,os
os.chdir(os.path.expanduser("~/rapture-run/validation/capture"))
for n in sorted(os.listdir(".")):
    p=os.path.join(n,"meta.json")
    if not os.path.exists(p): print("%-22s in progress" % n); continue
    m=json.load(open(p))
    if "error" in m: print("%-22s ERROR %s" % (n, m["error"][:100])); continue
    g=[json.loads(l)["reply"] for l in open(os.path.join(n,"gens.jsonl"))]
    print("%-22s %-4s drift_v2=%-7s regex_refusal=%-6s sha_ok=%s %ss garbage=%d empty=%d" % (n, m["split"], m["drift_v2_sanity"], m["regex_refusal_rate"], m["sha_matches_hub"], m["seconds"], sum("!!!!" in x for x in g), sum(not x.strip() for x in g)))
