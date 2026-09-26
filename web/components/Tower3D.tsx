"use client";
// The side view: one tower of 28 discs per checkpoint, built from the real Atlas document.
// Disc colour = refusal signal at that layer (clay weak → purple strong). A scored layer that kept
// less than HOLLOW_BELOW of the base's signal is drawn hollow; the gold label marks the display band. Pending docs are ghost towers with a
// "reading" sweep; when one flips to scanned, its discs fill bottom-to-top from the real numbers.
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { HOLLOW_BELOW } from "@/lib/metrics";

export interface TowerSpec {
  id: string;
  name: string;
  state: "scanned" | "pending" | "error";
  /** Display-only band (where refusal concentrates) — labelled, not scored. */
  band: number[];
  /** Scored layers (`refusal_specific_layers`) — a scored layer that lost its signal is drawn hollow. */
  scored: number[];
  signal?: number[];
  retained?: number[];
  label: React.ReactNode;
}

interface Props {
  towers: TowerSpec[];
  nLayers: number;
  selected: { id: string; layer: number } | null;
  onSelect: (id: string, layer: number) => void;
  /** Ids whose fill animation should play (just flipped pending → scanned). */
  reveal: Set<string>;
}

const PITCH = 0.62, DISC_H = 0.44, SPACING = 8.5, FILL_MS = 110;
const C_LOW = new THREE.Color("#dcc9a6"), C_HIGH = new THREE.Color("#7a1230");
const C_HOLLOW = new THREE.Color("#e6dcc4"), C_GHOST = new THREE.Color("#d3c7ac"), GOLD = new THREE.Color("#9a6f1c");
// sqrt curve so weak-but-present layers still carry colour instead of washing out to clay.
const sigColor = (s: number) => C_LOW.clone().lerp(C_HIGH, Math.sqrt(Math.max(0, Math.min(1, s))));

interface Disc extends THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial> {
  userData: { id: string; layer: number; ghost: boolean };
}

export default function Tower3D({ towers, nLayers, selected, onSelect, reveal }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const labelEls = useRef(new Map<string, HTMLDivElement>());
  const bandEl = useRef<HTMLDivElement>(null);
  const world = useRef<{
    scene: THREE.Scene; camera: THREE.PerspectiveCamera; groups: Map<string, THREE.Group>;
    discs: Disc[]; revealAt: Map<string, number>; fit: () => void;
  } | null>(null);
  const cb = useRef({ onSelect, selected });
  cb.current = { onSelect, selected };

  // Scene, camera, lights, orbit controls, render loop — once.
  useEffect(() => {
    const el = wrap.current!, cv = canvas.current!;
    const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#ece1c9");
    scene.fog = new THREE.Fog(0xece1c9, 130, 340);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
    scene.add(new THREE.HemisphereLight(0xfff4dc, 0x8a7350, 1.25));
    const key = new THREE.DirectionalLight(0xffe9c2, 0.9); key.position.set(-10, 20, 14); scene.add(key);
    const fill = new THREE.DirectionalLight(0xdcbfa0, 0.35); fill.position.set(12, 6, -8); scene.add(fill);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(120, 64), new THREE.MeshStandardMaterial({ color: 0xe0d3b6, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.15; scene.add(ground);

    const target = new THREE.Vector3(0, (nLayers * PITCH) / 2, 0);
    let az = 0.22, pol = 1.18, rad = 40, tAz = az, tPol = pol, tRad = rad;
    const w = { scene, camera, groups: new Map(), discs: [] as Disc[], revealAt: new Map<string, number>(),
      // Pull the camera back until the whole row fits the canvas width (and the tower fits its height).
      fit: () => {
        const n = Math.max(1, w.groups.size), half = ((n - 1) * SPACING) / 2 + 7;
        const vf = THREE.MathUtils.degToRad(camera.fov) / 2, hf = Math.atan(Math.tan(vf) * camera.aspect);
        tRad = rad = Math.min(160, Math.max((half * 1.12) / Math.tan(hf) + 6, (nLayers * PITCH) / 2 / Math.tan(vf) + 14));
      } };
    world.current = w;

    let dragging = false, moved = false, px = 0, py = 0;
    const rc = new THREE.Raycaster(), ndc = new THREE.Vector2();
    const pick = (e: PointerEvent | MouseEvent) => {
      const r = cv.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      rc.setFromCamera(ndc, camera);
      return (rc.intersectObjects(w.discs, false)[0]?.object as Disc | undefined) ?? null;
    };
    let hovered: Disc | null = null;
    const down = (e: PointerEvent) => { dragging = true; moved = false; px = e.clientX; py = e.clientY; cv.style.cursor = "grabbing"; };
    const up = () => { dragging = false; cv.style.cursor = ""; };
    const move = (e: PointerEvent) => {
      if (dragging) {
        const dx = e.clientX - px, dy = e.clientY - py;
        if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
        tAz -= dx * 0.007; tPol = Math.max(0.12, Math.min(1.45, tPol - dy * 0.006)); px = e.clientX; py = e.clientY;
        return;
      }
      hovered = pick(e);
      cv.style.cursor = hovered && !hovered.userData.ghost ? "pointer" : "grab";
    };
    const click = (e: MouseEvent) => {
      if (moved) return;
      const hit = pick(e);
      if (hit && !hit.userData.ghost) cb.current.onSelect(hit.userData.id, hit.userData.layer);
    };
    const wheel = (e: WheelEvent) => { e.preventDefault(); tRad = Math.max(18, Math.min(160, tRad + e.deltaY * 0.03)); };
    cv.addEventListener("pointerdown", down); addEventListener("pointerup", up); cv.addEventListener("pointermove", move);
    cv.addEventListener("click", click); cv.addEventListener("wheel", wheel, { passive: false });

    const resize = () => {
      const { width, height } = el.getBoundingClientRect();
      renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
      w.fit();
    };
    const ro = new ResizeObserver(resize); ro.observe(el); resize();

    const v = new THREE.Vector3();
    const project = (p: THREE.Vector3) => {
      v.copy(p).project(camera);
      const r = el.getBoundingClientRect();
      return { x: (v.x * 0.5 + 0.5) * r.width, y: (-v.y * 0.5 + 0.5) * r.height, vis: v.z < 1 };
    };

    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      az += (tAz - az) * 0.09; pol += (tPol - pol) * 0.09; rad += (tRad - rad) * 0.09;
      const sp = Math.sin(pol);
      camera.position.set(target.x + rad * sp * Math.sin(az), target.y + rad * Math.cos(pol), target.z + rad * sp * Math.cos(az));
      camera.lookAt(target);

      const sel = cb.current.selected;
      for (const d of w.discs) {
        const { id, layer, ghost } = d.userData;
        if (ghost) {
          // Reading sweep: a gold glow climbs the ghost tower, with a fading trail.
          const head = ((now / 70) % (nLayers + 8)) - 4;
          const k = Math.max(0, 1 - Math.abs(layer - head) / 3.5);
          d.material.emissive.copy(GOLD); d.material.emissiveIntensity = 0.55 * k;
          d.material.opacity = 0.18 + 0.4 * k;
          continue;
        }
        const t0 = w.revealAt.get(id);
        if (t0 != null) {
          const t = (now - t0 - layer * FILL_MS) / 260;
          const s = t <= 0 ? 0.001 : t >= 1 ? 1 : 1 - (1 - t) ** 3;
          d.scale.set(s, s, s);
        }
        const on = sel && sel.id === id && sel.layer === layer ? 0.45 : hovered === d ? 0.2 : 0;
        d.material.emissive.copy(GOLD); d.material.emissiveIntensity = on;
      }

      for (const [id, g] of w.groups) {
        const lab = labelEls.current.get(id);
        if (!lab) continue;
        const p = project(v.set(g.position.x, nLayers * PITCH + 1.4, g.position.z));
        lab.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
        lab.style.opacity = p.vis ? "1" : "0";
      }
      const first = [...w.groups.values()][0];
      const band = first?.userData.band as number[] | undefined;
      if (bandEl.current && first && band?.length) {
        const mid = ((band[0] + band[band.length - 1]) / 2) * PITCH;
        const p = project(v.set(first.position.x - 6.0, mid, first.position.z));
        bandEl.current.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
        bandEl.current.style.opacity = p.vis ? "1" : "0";
      }
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      removeEventListener("pointerup", up);
      renderer.dispose();
      world.current = null;
    };
  }, [nLayers]);

  // (Re)build towers whenever the documents change.
  const sig = towers.map((t) => `${t.id}:${t.state}:${t.signal?.join(",") ?? ""}`).join("|");
  useEffect(() => {
    const w = world.current;
    if (!w) return;
    for (const g of w.groups.values()) {
      w.scene.remove(g);
      g.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); (m.material as THREE.Material | undefined)?.dispose?.(); });
    }
    w.groups.clear(); w.discs = [];
    const x0 = -((towers.length - 1) * SPACING) / 2;
    towers.forEach((t, i) => {
      const g = new THREE.Group();
      g.position.set(x0 + i * SPACING, 0, 0);
      g.userData = { band: t.band };
      const scored = new Set(t.scored);
      const ghost = t.state !== "scanned";
      for (let L = 0; L < nLayers; L++) {
        const r = THREE.MathUtils.lerp(3.1, 1.6, L / (nLayers - 1));
        const geo = new THREE.CylinderGeometry(r * 0.92, r, DISC_H, 56);
        const hollow = !ghost && scored.has(L) && (t.retained?.[L] ?? 1) < HOLLOW_BELOW;
        const mat = new THREE.MeshStandardMaterial({
          color: ghost ? C_GHOST : hollow ? C_HOLLOW : sigColor(t.signal?.[L] ?? 0),
          roughness: 0.82, metalness: 0, transparent: ghost || hollow, opacity: ghost ? 0.22 : hollow ? 0.32 : 1,
        });
        const m = new THREE.Mesh(geo, mat) as unknown as Disc;
        m.position.y = L * PITCH + DISC_H * 0.6;
        m.userData = { id: t.id, layer: L, ghost };
        if (hollow) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x9a2340, transparent: true, opacity: 0.85 })));
        if (t.state === "error") mat.color = new THREE.Color("#c9a79a");
        g.add(m); w.discs.push(m);
      }
      w.scene.add(g); w.groups.set(t.id, g);
    });
    for (const id of reveal) if (!w.revealAt.has(id)) w.revealAt.set(id, performance.now());
    w.fit();
  }, [sig, nLayers]); // eslint-disable-line react-hooks/exhaustive-deps

  // A reveal requested after the towers were built (same data, new flag).
  useEffect(() => {
    const w = world.current;
    if (!w) return;
    for (const id of reveal) if (!w.revealAt.has(id)) w.revealAt.set(id, performance.now());
  }, [reveal]);

  return (
    <div ref={wrap} className="stage3d">
      <canvas ref={canvas} />
      {towers.map((t) => (
        <div key={t.id} className="tlabel" ref={(el) => { if (el) labelEls.current.set(t.id, el); else labelEls.current.delete(t.id); }}>
          {t.label}
        </div>
      ))}
      <div ref={bandEl} className="band-label">where refusal<br />concentrates</div>
    </div>
  );
}
