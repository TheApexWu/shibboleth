"""Merge a plain LoRA adapter (no rslora, no modules_to_save) into the base weights: W' = W + (alpha/r) * B @ A.
Writes a full safetensors checkpoint that loads like any other model. Refuses anything it cannot merge exactly."""
from __future__ import annotations
import json, os, shutil, sys
import torch
from safetensors.torch import load_file, save_file

base_dir, lora_dir, out_dir = sys.argv[1:4]
cfg = json.load(open(os.path.join(lora_dir, "adapter_config.json")))
assert not cfg.get("use_rslora") and not cfg.get("modules_to_save"), "unsupported adapter layout"
scale = cfg["lora_alpha"] / cfg["r"]
base = load_file(os.path.join(base_dir, "model.safetensors"))
ad = load_file(os.path.join(lora_dir, "adapter_model.safetensors"))
a_keys = sorted(k for k in ad if k.endswith("lora_A.weight"))
assert len(a_keys) and all(k.replace("lora_A", "lora_B") in ad for k in a_keys), "unpaired LoRA tensors"
other = [k for k in ad if "lora_A" not in k and "lora_B" not in k]
assert not other, f"adapter carries non-LoRA tensors: {other[:3]}"
changed, rel = 0, []
for k in a_keys:
    target = k.replace("base_model.model.", "", 1).replace(".lora_A.weight", ".weight")
    assert target in base, f"no base tensor for {target}"
    W = base[target]
    delta = scale * (ad[k.replace("lora_A", "lora_B")].float() @ ad[k].float())
    assert delta.shape == W.shape, (target, delta.shape, W.shape)
    base[target] = (W.float() + delta).to(W.dtype)
    rel.append(float(delta.norm() / W.float().norm()))
    changed += 1
os.makedirs(out_dir, exist_ok=True)
save_file(base, os.path.join(out_dir, "model.safetensors"), metadata={"format": "pt"})
for f in os.listdir(base_dir):
    if f != "model.safetensors" and not f.endswith(".safetensors"):
        shutil.copy(os.path.join(base_dir, f), out_dir)
json.dump({"lora": lora_dir, "scale": scale, "r": cfg["r"], "targets": cfg["target_modules"], "tensors_changed": changed,
           "median_relative_delta": sorted(rel)[len(rel) // 2], "max_relative_delta": max(rel)},
          open(os.path.join(out_dir, "merge_meta.json"), "w"), indent=1)
print(f"{os.path.basename(out_dir)}: {changed} tensors, scale {scale}, median |dW|/|W| {sorted(rel)[len(rel)//2]:.4f}, max {max(rel):.4f}")
