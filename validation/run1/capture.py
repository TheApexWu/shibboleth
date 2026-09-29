"""Capture raw evidence per checkpoint for the 28 Sep validation run. Analysis happens offline on
what this saves, so no model is ever loaded twice and drift/label definitions can change freely.

Per checkpoint -> capture/<name>/: resid.pt (last-token residuals, every layer, fp16, for the frozen
32 harmful + 22 harmless held-out prompts), gens.jsonl (greedy 128-token replies to the disjoint JBB
label prompts), meta.json (sha256, timings, drift_v2 sanity number, or the error).

Every checkpoint is read through the BASE tokenizer and chat template, so candidates see identical
input tokens. Run with /usr/bin/python3 from ~/shibboleth-build.
"""
from __future__ import annotations
import hashlib, json, os, sys, time, traceback
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

sys.path.insert(0, os.path.expanduser("~/shibboleth-build"))
from shibboleth import core, fingerprint as fp, scan  # noqa: E402

V = os.path.expanduser("~/rapture-run/validation")
BASE_DIR = os.path.expanduser("~/rapture-run/models/base")
GEN_TOKENS, BATCH = 128, 8


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 24), b""):
            h.update(chunk)
    return h.hexdigest()


def weights_sha(d):
    files = sorted(f for f in os.listdir(d) if f.endswith(".safetensors"))
    return {f: sha256(os.path.realpath(os.path.join(d, f))) for f in files}


@torch.no_grad()
def generate(tok, net, dev, prompts):
    tok.padding_side = "left"
    out = []
    for i in range(0, len(prompts), BATCH):
        texts = [core.chat(tok, p) for p in prompts[i:i + BATCH]]
        ids = tok(texts, return_tensors="pt", padding=True).to(dev)
        g = net.generate(**ids, max_new_tokens=GEN_TOKENS, do_sample=False, pad_token_id=tok.pad_token_id)
        out += tok.batch_decode(g[:, ids["input_ids"].shape[1]:], skip_special_tokens=True)
    return out


def capture(entry, base, tok, ho_s, labels, dev):
    d = os.path.join(V, "capture", entry["name"])
    os.makedirs(d, exist_ok=True)
    meta = {**entry, "attn": "eager", "dtype": "bfloat16", "started": time.strftime("%Y-%m-%dT%H:%M:%S")}
    t0 = time.time()
    meta["weights_sha256"] = weights_sha(entry["path"])
    meta["sha_matches_hub"] = all(meta["weights_sha256"].get(f) == v["sha256"] for f, v in entry["expected_weights"].items())
    # eager attention: MPS + sdpa + left padding emits "!!!!" in batched greedy decoding (tested 28 Sep:
    # eager/bf16 batch-8 matched batch-1 on 8/8 prompts, sdpa/fp16 garbled 7/8). Same setting for residuals,
    # so the captured base run is the like-for-like reference, not the sdpa-built base.pt fingerprint.
    net = AutoModelForCausalLM.from_pretrained(entry["path"], dtype=torch.bfloat16, attn_implementation="eager").to(dev).eval()
    rh = core.residual_all_layers(tok, net, dev, base["ho_h"])
    rs = core.residual_all_layers(tok, net, dev, ho_s)
    torch.save({"harmful": rh.half(), "harmless": rs.half()}, os.path.join(d, "resid.pt"))
    f = core.project(rh, base["dirs"]).mean(0)
    meta["drift_v2_sanity"] = round(fp.drift(f, base["base_fp"], base["base_ctrl"], base["spec"]), 4)
    gens = generate(tok, net, dev, [x["goal"] for x in labels])
    with open(os.path.join(d, "gens.jsonl"), "w") as fh:
        for x, g in zip(labels, gens):
            fh.write(json.dumps({"prompt": x["goal"], "category": x["category"], "reply": g,
                                 "regex_refusal": core.is_refusal(g)}, ensure_ascii=False) + "\n")
    meta["regex_refusal_rate"] = round(sum(core.is_refusal(g) for g in gens) / len(gens), 4)
    meta["seconds"] = round(time.time() - t0, 1)
    del net
    torch.mps.empty_cache() if dev == "mps" else None
    return meta


def main():
    manifest = json.load(open(os.path.join(V, "manifest.json")))
    only = set(sys.argv[1:])
    base = scan.load_base(os.path.expanduser("~/shibboleth-build/runs/base.pt"))
    ho_s = json.load(open(os.path.expanduser("~/shibboleth-build/data/prompts.local.json")))["harmless_heldout"]
    labels = json.load(open(os.path.join(V, "labels_jbb_disjoint.json")))["prompts"]
    tok = AutoTokenizer.from_pretrained(BASE_DIR)
    dev = "mps" if torch.backends.mps.is_available() else "cpu"
    for entry in manifest["checkpoints"]:
        if only and entry["name"] not in only:
            continue
        out = os.path.join(V, "capture", entry["name"], "meta.json")
        if os.path.exists(out) and "error" not in json.load(open(out)):
            continue
        exp = entry["expected_weights"]
        ready = bool(exp) and all(os.path.exists(os.path.join(entry["path"], f)) and
                                  os.path.getsize(os.path.join(entry["path"], f)) == v["size"] for f, v in exp.items())
        if not ready:
            print(f"[{time.strftime('%H:%M')}] not ready {entry['name']}", flush=True)
            continue
        print(f"[{time.strftime('%H:%M')}] capture {entry['name']}", flush=True)
        try:
            meta = capture(entry, base, tok, ho_s, labels, dev)
        except Exception as e:
            meta = {**entry, "error": f"{type(e).__name__}: {e}", "trace": traceback.format_exc()[-2000:]}
        os.makedirs(os.path.dirname(out), exist_ok=True)
        json.dump(meta, open(out, "w"), indent=1)
        print(f"   -> {'ERROR ' + meta['error'][:120] if 'error' in meta else 'drift_v2 %s regex_refusal %s (%ss)' % (meta['drift_v2_sanity'], meta['regex_refusal_rate'], meta['seconds'])}", flush=True)


if __name__ == "__main__":
    main()
