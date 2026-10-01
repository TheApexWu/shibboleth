"""Figures for the run-2 write-up, drawn only from results2.json and nulls2.json (the same seeded null draws as the
pre-registered analysis, re-run with the draws saved; the re-run's results must equal results2.json, checked below)."""
import json, sys
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

D = sys.argv[1]
R = json.load(open(f"{D}/../results/results2.json"))
N = json.load(open(f"{D}/../results/nulls2.json"))
rows, P = R["rows"], R["primary_test"]
ARMS = {"xstest": "XSTest (matched pairs, primary)", "heretic": "heretic (embedding-matched)", "run1": "run 1 (unmatched)"}

SHORT = {"base": "Base (reference)", "unsloth": "Mirror (same weights)", "twin": "Josiefied (abliterated)",
         "coder": "Qwen2.5-Coder", "abl-elstuhn": "Elstuhn", "abl-sirreajohn": "Sirreajohn", "abl-dekodez": "DeKodez",
         "abl-aianytime": "ai-anytime", "abl-haseebasif": "HaseebAsif", "abl-opsmalware": "ops-malware",
         "ben-fin-code": "Financial code", "ben-qa360": "QA360", "ben-tinyswallow": "TinySwallow (JA)",
         "ben-zh-correction": "Chinese correction", "ben-archrouter": "Arch-Router", "ben-alfworld": "ALFWorld agent",
         "ben-vikhr": "Vikhr (RU)", "hard-math": "Qwen2.5-Math", "unk-malikeh-safety": "Safety-distilled",
         "unk-ramlexsi-simdpo": "SimDPO unlearning", "ft-itsmepv": "LoRA itsmepv", "ft-anonymuspj7": "LoRA anonymuspj7",
         "ft-allout2726": "LoRA allout2726"}
ORDER = ["base", "unsloth", "twin", "coder",
         "abl-elstuhn", "abl-sirreajohn", "abl-dekodez", "abl-aianytime", "abl-haseebasif", "ft-anonymuspj7",
         "ben-qa360", "ben-tinyswallow", "ben-zh-correction", "ben-archrouter", "ben-alfworld", "ben-vikhr", "hard-math",
         "abl-opsmalware", "ben-fin-code", "ft-itsmepv", "ft-allout2726", "unk-malikeh-safety", "unk-ramlexsi-simdpo"]
assert sorted(ORDER) == sorted(rows), "every checkpoint drawn exactly once"
STRIPPED, BENIGN, OTHER = "#c2410c", "#1d4ed8", "#8a8f98"

def style(n):
    l = rows[n]["label"]
    if l == 1: return dict(color=STRIPPED, marker="o", fill=True)
    if l == 0: return dict(color=BENIGN, marker="s", fill=True)
    if isinstance(l, str): return dict(color=OTHER, marker="D", fill=False)
    return dict(color=OTHER, marker="o", fill=False)

handles = [plt.Line2D([], [], marker="o", color=STRIPPED, ls="", label="stripped (declared + judged unsafe)"),
           plt.Line2D([], [], marker="s", color=BENIGN, ls="", label="benign (declared + judged safe)"),
           plt.Line2D([], [], marker="D", mfc="white", color=OTHER, ls="", label="excluded: declaration and behavior disagree"),
           plt.Line2D([], [], marker="o", mfc="white", color=OTHER, ls="", label="dev, mirror, unknown-effect")]
plt.rcParams.update({"font.family": "Helvetica Neue", "font.size": 8.5, "axes.spines.top": False, "axes.spines.right": False})

# Figure 1: drift_v3 (XSTest direction) per checkpoint with bootstrap intervals and both judges' unsafe rates
fig, ax = plt.subplots(figsize=(6.9, 6.2))
for i, n in enumerate(ORDER):
    r, s = rows[n], style(n); y = len(ORDER) - 1 - i
    lo, hi = r["xstest_v3_ci"]
    ax.plot([lo, hi], [y, y], color=s["color"], lw=1.6, alpha=.8)
    ax.scatter(r["xstest_v3"], y, s=34, marker=s["marker"], facecolors=s["color"] if s["fill"] else "white",
               edgecolors=s["color"], linewidths=1.3, zorder=3)
    ax.text(-0.02, y, f"{SHORT[n]}  ", ha="right", va="center", fontsize=8, transform=ax.get_yaxis_transform())
    ax.text(1.02, y, f"{r['unsafe_qwen3guard']:.0%} / {r['harm_granite']:.0%}", ha="left", va="center", fontsize=7.3,
            color="#444", transform=ax.get_yaxis_transform())
ax.axvline(0.5, color="#222", lw=.9, ls="--")
for y0 in (18.5, 12.5, 5.5):
    ax.axhline(y0, color="#ccc", lw=.6)
ax.text(1.02, len(ORDER) - 0.2, "unsafe: Qwen3Guard / Granite", ha="left", fontsize=7.2, color="#444", transform=ax.get_yaxis_transform())
ax.set_yticks([]); ax.set_xlim(-0.03, 1.03); ax.set_ylim(-0.7, len(ORDER) - 0.1)
ax.set_xlabel("drift_v3 with the XSTest direction (0 = like the base, 1 = far from it), 95% bootstrap interval")
ax.legend(handles=handles, loc="upper center", bbox_to_anchor=(0.42, -0.08), ncol=2, fontsize=7.2, frameon=False)
fig.tight_layout(); fig.savefig(f"{D}/fig2_drift_v3.svg"); plt.close(fig)

# Figure 2: random-direction null of the standardized difference, per arm, for drift_v3 and -rho
fig, axes = plt.subplots(2, 3, figsize=(6.9, 3.9), sharey="row")
for j, arm in enumerate(ARMS):
    for i, (key, lab) in enumerate((("v3", "drift_v3"), ("neg_rho", "−ρ"))):
        ax = axes[i][j]; v = [x for x in N["dnulls"][arm][key] if x is not None]
        obs, p = P[f"{arm}_{key}_stddiff"], P[f"{arm}_{key}_stddiff_p"]
        ax.hist(v, bins=24, color="#9aa5b8", edgecolor="white")
        ax.axvline(obs, color=STRIPPED, lw=1.6)
        ax.set_title(f"{lab}, {arm}: p = {p:.3f}", fontsize=7.8)
        if j == 0: ax.set_ylabel("random draws", fontsize=7.5)
        if i == 1: ax.set_xlabel("standardized difference", fontsize=7.5)
fig.suptitle("Observed separation (red) against 200 random directions in place of the refusal direction", fontsize=8.4)
fig.tight_layout(); fig.savefig(f"{D}/fig2_null.svg"); plt.close(fig)

# Figure 3: Hurtado's plane with the XSTest direction
fig, ax = plt.subplots(figsize=(6.4, 4.6))
for n in ORDER:
    r, s = rows[n], style(n)
    ax.scatter(r["E1"], r["xstest_rho"], s=40, marker=s["marker"], facecolors=s["color"] if s["fill"] else "white",
               edgecolors=s["color"], linewidths=1.3, zorder=3)
NOTE = {"ft-anonymuspj7": (8, -3), "hard-math": (7, 3), "abl-dekodez": (8, 2), "ben-zh-correction": (6, 4),
        "ft-itsmepv": (6, -9), "ft-allout2726": (6, 3), "ben-fin-code": (6, 4), "coder": (7, 3), "abl-opsmalware": (-62, 6)}
for n, (dx, dy) in NOTE.items():
    ax.annotate(SHORT[n], (rows[n]["E1"], rows[n]["xstest_rho"]), textcoords="offset points", xytext=(dx, dy), fontsize=7.4, color="#333")
ax.set_xlabel("E1: rank-1 share of the weight edit (high = abliteration-like)")
ax.set_ylabel("ρ with the XSTest direction (1 = gap like the base)")
ax.set_xlim(-0.04, 1.08)
ax.legend(handles=handles, loc="upper center", bbox_to_anchor=(0.45, -0.14), ncol=2, fontsize=7, frameon=False)
fig.tight_layout(); fig.savefig(f"{D}/fig2_hurtado_plane.svg"); plt.close(fig)

# Figure 4: the two judges, per checkpoint
fig, ax = plt.subplots(figsize=(4.2, 3.5))
for n in ORDER:
    r, s = rows[n], style(n)
    ax.scatter(r["unsafe_qwen3guard"], r["harm_granite"], s=34, marker=s["marker"], facecolors=s["color"] if s["fill"] else "white",
               edgecolors=s["color"], linewidths=1.2, zorder=3)
ax.plot([0, 1], [0, 1], color="#bbb", lw=.8); ax.axvline(.5, color="#ddd", lw=.7, ls="--"); ax.axhline(.5, color="#ddd", lw=.7, ls="--")
ax.set_xlabel("Qwen3Guard-Gen-4B: share unsafe"); ax.set_ylabel("Granite Guardian 3.0-2B: share harmful")
ax.set_xlim(-.03, 1.03); ax.set_ylim(-.03, 1.03)
fig.tight_layout(); fig.savefig(f"{D}/fig2_judges.svg"); plt.close(fig)
print("figures written")
