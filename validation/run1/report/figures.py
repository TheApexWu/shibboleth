"""Three figures for the validation write-up, drawn only from results.json, manifest.json and null_aurocs.json."""
import json, sys
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

D = sys.argv[1]
R = json.load(open(f"{D}/results.json"))
rows, P = R["rows"], R["primary_test"]
null = json.load(open(f"{D}/null_aurocs.json"))

SHORT = {"base": "Base (reference)", "unsloth": "Mirror (same weights)", "twin": "Josiefied (abliterated)",
         "coder": "Qwen2.5-Coder", "abl-elstuhn": "Elstuhn", "abl-sirreajohn": "Sirreajohn", "abl-dekodez": "DeKodez",
         "abl-aianytime": "ai-anytime", "abl-haseebasif": "HaseebAsif", "abl-opsmalware": "ops-malware",
         "ben-fin-code": "Financial code", "ben-qa360": "QA360", "ben-tinyswallow": "TinySwallow (JA)",
         "ben-zh-correction": "Chinese correction", "ben-archrouter": "Arch-Router", "ben-alfworld": "ALFWorld agent",
         "ben-vikhr": "Vikhr (RU)", "hard-math": "Qwen2.5-Math", "unk-malikeh-safety": "Safety-distilled",
         "unk-ramlexsi-simdpo": "SimDPO unlearning"}
ORDER = ["base", "unsloth", "twin", "coder", "abl-elstuhn", "abl-sirreajohn", "abl-dekodez", "abl-aianytime",
         "abl-haseebasif", "abl-opsmalware", "ben-fin-code", "ben-qa360", "ben-tinyswallow", "ben-zh-correction",
         "ben-archrouter", "ben-alfworld", "ben-vikhr", "hard-math", "unk-malikeh-safety", "unk-ramlexsi-simdpo"]
STRIPPED, BENIGN, OTHER = "#c2410c", "#1d4ed8", "#8a8f98"

def style(n):
    l = rows[n]["label"]
    if l == 1: return dict(color=STRIPPED, marker="o", fill=True, cls="stripped (test)" if rows[n]["split"] == "test" else "stripped (dev)")
    if l == 0: return dict(color=BENIGN, marker="s", fill=True, cls="benign (test)" if rows[n]["split"] == "test" else "benign (dev)")
    if isinstance(l, str): return dict(color=OTHER, marker="D", fill=False, cls="excluded by behavior rule")
    return dict(color=OTHER, marker="o", fill=False, cls="controls / unknown effect")

plt.rcParams.update({"font.family": "Helvetica Neue", "font.size": 8.5, "axes.spines.top": False, "axes.spines.right": False})

# Figure 1: drift_v3 with bootstrap intervals, every checkpoint
fig, ax = plt.subplots(figsize=(6.9, 5.6))
for i, n in enumerate(ORDER):
    r, s = rows[n], style(n)
    y = len(ORDER) - 1 - i
    lo, hi = r["drift_v3_ci"]
    ax.plot([lo, hi], [y, y], color=s["color"], lw=1.6, alpha=.8)
    ax.scatter(r["drift_v3"], y, s=34, marker=s["marker"], facecolors=s["color"] if s["fill"] else "white",
               edgecolors=s["color"], linewidths=1.3, zorder=3)
    ax.text(-0.02, y, f"{SHORT[n]}  ", ha="right", va="center", fontsize=8, transform=ax.get_yaxis_transform())
    ax.text(1.02, y, f"{r['unsafe_rate']:.0%}", ha="left", va="center", fontsize=7.5, color="#444", transform=ax.get_yaxis_transform())
ax.axvline(0.5, color="#222", lw=.9, ls="--")
ax.text(0.5, len(ORDER) - 0.3, "threshold 0.5", ha="center", fontsize=7.5)
ax.text(1.02, len(ORDER) - 0.3, "unsafe", ha="left", fontsize=7.5, color="#444", transform=ax.get_yaxis_transform())
for y0 in (15.5, 9.5, 2.5):
    ax.axhline(y0, color="#ccc", lw=.6)
ax.text(0.99, 17.6, "dev", ha="right", fontsize=7.5, color="#666", transform=ax.get_yaxis_transform())
ax.text(0.99, 14.6, "test", ha="right", fontsize=7.5, color="#666", transform=ax.get_yaxis_transform())
ax.set_yticks([]); ax.set_xlim(-0.03, 1.03); ax.set_ylim(-0.7, len(ORDER) - 0.2)
ax.set_xlabel("drift_v3 (0 = refusal signal intact, 1 = gone), 95% bootstrap interval")
handles = [plt.Line2D([], [], marker="o", color=STRIPPED, ls="", label="stripped (declared + judged unsafe)"),
           plt.Line2D([], [], marker="s", color=BENIGN, ls="", label="benign (declared + judged safe)"),
           plt.Line2D([], [], marker="D", mfc="white", color=OTHER, ls="", label="excluded: declaration and behavior disagree"),
           plt.Line2D([], [], marker="o", mfc="white", color=OTHER, ls="", label="reference, mirror, unknown-effect")]
ax.legend(handles=handles, loc="upper center", bbox_to_anchor=(0.45, -0.1), ncol=2, fontsize=7.2, frameon=False)
fig.tight_layout(); fig.savefig(f"{D}/fig_drift_v3.svg"); plt.close(fig)

# Figure 2: Hurtado's plane, weight energy vs activation-gap ratio
fig, ax = plt.subplots(figsize=(6.4, 4.1))
for n in ORDER:
    r, s = rows[n], style(n)
    ax.scatter(r["E1"], r["rho"], s=40, marker=s["marker"], facecolors=s["color"] if s["fill"] else "white",
               edgecolors=s["color"], linewidths=1.3, zorder=3)
NOTE = {"abl-dekodez": (8, -2), "ben-zh-correction": (6, 4), "hard-math": (6, -9), "ben-fin-code": (6, 4),
        "abl-opsmalware": (-68, 4), "twin": (-112, -10), "coder": (6, 4), "abl-aianytime": (-52, -3)}
for n, (dx, dy) in NOTE.items():
    ax.annotate(SHORT[n], (rows[n]["E1"], rows[n]["rho"]), textcoords="offset points", xytext=(dx, dy), fontsize=7.4, color="#333")
ax.set_xlabel("E1: rank-1 share of the weight edit (high = abliteration-like)")
ax.set_ylabel("ρ: activation gap vs base (1 = intact)")
ax.set_xlim(-0.04, 1.06)
ax.legend(handles=handles, loc="lower left", fontsize=7, frameon=False)
fig.tight_layout(); fig.savefig(f"{D}/fig_hurtado_plane.svg"); plt.close(fig)

# Figure 3: random-direction null for drift_v3
obs = P["auroc_drift_v3"]
fig, ax = plt.subplots(figsize=(6.4, 2.6))
bins = [i / 35 for i in range(15, 36)]
ax.hist(null, bins=bins, color="#9aa5b8", edgecolor="white")
med = sorted(null)[len(null) // 2]
l1 = ax.axvline(obs, color=STRIPPED, lw=1.6, label=f"with the refusal direction: {obs:.2f}")
l2 = ax.axvline(med, color="#333", lw=.9, ls="--", label=f"median of random directions: {med:.2f}")
ax.legend(handles=[l1, l2], loc="upper left", fontsize=7.8, frameon=False)
ax.set_xlabel("drift_v3 AUROC on the test set when the refusal direction is replaced by a random direction (200 draws)")
ax.set_ylabel("draws")
fig.tight_layout(); fig.savefig(f"{D}/fig_null.svg"); plt.close(fig)
print("figures written", sum(x >= obs for x in null), "of", len(null), "null draws >= observed")
