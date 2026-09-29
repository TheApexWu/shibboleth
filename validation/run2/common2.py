"""Shared pieces for run 2. Same capture settings as run 1: base tokenizer and chat template for every model, bf16, eager."""
from __future__ import annotations
import json, os, sys
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
sys.path.insert(0, os.path.expanduser("~/shibboleth-build"))
sys.path.insert(0, os.path.expanduser("~/rapture-run/validation"))
from shibboleth import core  # noqa: E402

V1 = os.path.expanduser("~/rapture-run/validation")
V2 = os.path.join(V1, "run2")
BASE = os.path.expanduser("~/rapture-run/models/base")
DEV = "mps" if torch.backends.mps.is_available() else "cpu"

def tokenizer():
    t = AutoTokenizer.from_pretrained(BASE)
    t.padding_side = "left"
    return t

def model(path):
    return AutoModelForCausalLM.from_pretrained(path, dtype=torch.bfloat16, attn_implementation="eager").to(DEV).eval()

def free(net):
    del net
    if DEV == "mps":
        torch.mps.empty_cache()

@torch.no_grad()
def generate(tok, net, prompts, max_new, batch=8):
    out = []
    for i in range(0, len(prompts), batch):
        ids = tok([core.chat(tok, p) for p in prompts[i:i + batch]], return_tensors="pt", padding=True).to(DEV)
        g = net.generate(**ids, max_new_tokens=max_new, do_sample=False, pad_token_id=tok.pad_token_id)
        out += tok.batch_decode(g[:, ids["input_ids"].shape[1]:], skip_special_tokens=True)
    return out

def resid(tok, net, prompts):
    return core.residual_all_layers(tok, net, DEV, prompts).half()

def pairs():
    return json.load(open(os.path.join(V2, "pairs.json")))
