// Same math as shibboleth/fingerprint.py::drift_v3, over stored lists. On a drift_v2 Atlas doc,
// `control` is the base's harmless mean, so the same formula reduces to fingerprint.py::drift.
// The UI recomputes per-layer retention so the tower can light each floor; it never re-scores.

const clamp = (x: number, lo = 0, hi = 1) => (x < lo ? lo : x > hi ? hi : x);

/** This checkpoint's harmful-minus-harmless gap at layer L over the base's (0 = gone, 1 = as large). */
export function retainedPerLayer(fp: number[], ctrl: number[], baseFp: number[], baseCtrl: number[]): number[] {
  return fp.map((v, L) => clamp((v - ctrl[L]) / (baseFp[L] - baseCtrl[L] + 1e-6)));
}

// torch.median returns the lower middle value on even counts, so this does too.
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[(s.length - 1) >> 1];
}

export function driftAt(fp: number[], ctrl: number[], baseFp: number[], baseCtrl: number[], layers: number[]): number {
  if (!layers.length) return 0;
  const r = retainedPerLayer(fp, ctrl, baseFp, baseCtrl);
  return clamp(1 - median(layers.map((L) => r[L])));
}

export function pct(x: number | undefined): string {
  return x == null ? "—" : `${Math.round(x * 100)}%`;
}

export function num(x: number | undefined, d = 2): string {
  return x == null ? "—" : x.toFixed(d);
}

/** A band layer keeping less than this share of the base signal is drawn hollow. */
export const HOLLOW_BELOW = 0.35;

/**
 * Disc colour: this model's harmful-minus-harmless gap along the direction at each layer, scaled so
 * the base's largest gap is 1.
 */
export function signalPerLayer(fp: number[], ctrl: number[], baseFp: number[], baseCtrl: number[]): number[] {
  const peak = Math.max(...baseFp.map((v, L) => v - baseCtrl[L]), 1e-6);
  return fp.map((v, L) => clamp((v - ctrl[L]) / peak));
}

/**
 * Lean: RMS distance over the scored layers between this checkpoint's retained-signal profile
 * and (a) the trusted base (all 1s) and (b) each known imposter. position = toBase / (toBase + toImposter):
 * 0 = looks like the base, 1 = looks like the nearest imposter. Raw cosine can't do this job: it
 * ignores magnitude, and abliteration mostly shrinks the band rather than changing its shape.
 */
export function lean(
  retained: number[], band: number[], imposters: { model: string; retained: number[] }[],
): { position: number; toBase: number; toImposter: number; imposter: string } | null {
  if (!imposters.length || !band.length) return null;
  const dist = (a: (L: number) => number) => Math.sqrt(band.reduce((s, L) => s + a(L) ** 2, 0) / band.length);
  const toBase = dist((L) => retained[L] - 1);
  const [best] = imposters
    .map((m) => ({ model: m.model, d: dist((L) => retained[L] - m.retained[L]) }))
    .sort((a, b) => a.d - b.d);
  const sum = toBase + best.d;
  return { position: sum ? toBase / sum : 0.5, toBase, toImposter: best.d, imposter: best.model };
}

/** Short, demo-friendly name: drop the family tokens every derivative shares. */
export function displayName(id: string): string {
  const [org, last = org] = id.split("/");
  // Run 2's harmful LoRAs share repo names (model_harmful_lora), so the uploader is the distinguishing part.
  if (id.endsWith(" (merged LoRA)")) return `${org} LoRA`.toUpperCase();
  const core = last.replace(/qwen2\.5/i, "").replace(/1\.5b/i, "").replace(/instruct/i, "")
    .replace(/-{2,}/g, "-").replace(/^-|-$/g, "");
  return (core || org).toUpperCase();
}

/**
 * Display-only refusal band (docs/SCHEMA.md): the contiguous run of layers around the base's peak
 * where its margin (fingerprint − control) is ≥ half its max: where the base signal peaks along the direction.
 * Not the scored layers: drift is measured over `refusal_specific_layers`, which can be the whole tower.
 */
export function displayBand(baseFp: number[], ctrl: number[]): number[] {
  const m = baseFp.map((v, L) => v - ctrl[L]);
  const peak = m.indexOf(Math.max(...m));
  const cut = 0.5 * m[peak];
  let lo = peak, hi = peak;
  while (lo > 0 && m[lo - 1] >= cut) lo--;
  while (hi < m.length - 1 && m[hi + 1] >= cut) hi++;
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
}
