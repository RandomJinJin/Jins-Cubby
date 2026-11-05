You are given a task to integrate an existing React component in the codebase

The codebase should support:
- shadcn project structure  
- Tailwind CSS
- Typescript

If it doesn't, provide instructions on how to setup project via shadcn CLI, install Tailwind or Typescript.

Determine the default path for components and styles. 
If default path for components is not /components/ui, provide instructions on why it's important to create this folder
Copy-paste this component to /components/ui folder:
```tsx
orbit-timeline.tsx
"use client";

import * as React from "react";

export type OrbitTimelineEvent = {
  /** Short date shown on the card, e.g. "Mar" or "Mar 12" */
  date?: string;
  title: string;
  description?: string;
  /** Any 24×24 stroke icon, e.g. a lucide-react icon. Falls back to a dot. */
  icon?: React.ReactNode;
};

export type OrbitTimelineYear = {
  year: number | string;
  events: OrbitTimelineEvent[];
};

export type OrbitTimelineSelection = {
  year: OrbitTimelineYear;
  event: OrbitTimelineEvent;
  /** Index of the event across the whole timeline */
  index: number;
} | null;

export interface OrbitTimelineProps {
  /** Years from the first (inner orbit) to the latest (outer orbit) */
  data: OrbitTimelineYear[];
  /** Colour scheme of the whole component, background included */
  theme?: "dark" | "light";
  /** Show the year labels in the gaps of the orbits */
  showYears?: boolean;
  /** Orbit speed multiplier, 0 stops the rotation */
  speed?: number;
  /** "alternate" spins every other orbit the opposite way */
  direction?: "same" | "alternate";
  /** Play the growth intro on mount */
  intro?: boolean;
  /** Change this number to replay the growth intro */
  replayKey?: number;
  /** Font stack for the year labels */
  yearFont?: string;
  /** Called when an event is opened or closed */
  onSelect?: (selection: OrbitTimelineSelection) => void;
  className?: string;
  style?: React.CSSProperties;
}

const STYLE_ID = "orbit-timeline-styles";

const CSS = `
@property --ot-k { syntax: '<number>'; inherits: false; initial-value: 1; }
@property --ot-rr { syntax: '<length>'; inherits: false; initial-value: 0px; }
.ot-root, .ot-root *, .ot-root *::before { box-sizing: border-box; }
.ot-root { position: relative; width: 100%; height: 100%; min-height: 360px; overflow: hidden; background: var(--ot-bg); color: rgb(var(--ot-fg));
  -webkit-tap-highlight-color: transparent; --ot-glow: .6; }
.ot-root[data-theme="dark"] { --ot-o1: #e4e4e8; --ot-o2: #3e3e45; --ot-o3: #96969e; --ot-ac: #f2f2f4; --ot-on-ac: #111114; --ot-bg: #0f1117; --ot-fg: 255,255,255; color-scheme: dark; }
.ot-root[data-theme="light"] { --ot-o1: #ffffff; --ot-o2: #a3a3aa; --ot-o3: #dadadf; --ot-ac: #26262b; --ot-on-ac: #ffffff; --ot-bg: #f7f7f5; --ot-fg: 23,23,26; color-scheme: light; }

.ot-orbit { position: absolute; left: 50%; top: 50%; border-radius: 50%; pointer-events: none; --ot-rw: 1.25px; --ot-g0: 0deg; --ot-g1: 0deg;
  transform: translate(-50%, -50%) scale(var(--ot-s, 1)); opacity: var(--ot-o, 1); transition: opacity .5s, transform .9s cubic-bezier(.2,.8,.2,1); }
.ot-orbit > i { position: absolute; inset: 0; border-radius: 50%; display: block; transition: opacity .45s;
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - var(--ot-rw)), #000 calc(100% - var(--ot-rw) + .25px), #000 100%),
    conic-gradient(from 0deg, transparent var(--ot-g0), #000 var(--ot-g1), #000 calc(360deg - var(--ot-g1)), transparent calc(360deg - var(--ot-g0)));
  -webkit-mask-composite: source-in;
  mask: radial-gradient(farthest-side, transparent calc(100% - var(--ot-rw)), #000 calc(100% - var(--ot-rw) + .25px), #000 100%),
    conic-gradient(from 0deg, transparent var(--ot-g0), #000 var(--ot-g1), #000 calc(360deg - var(--ot-g1)), transparent calc(360deg - var(--ot-g0)));
  mask-composite: intersect; }
.ot-orbit .ot-ln { background: conic-gradient(from -70deg, rgba(var(--ot-fg), .5), rgba(var(--ot-fg), .16) 25%, rgba(var(--ot-fg), .06) 50%, rgba(var(--ot-fg), .16) 75%, rgba(var(--ot-fg), .5));
  filter: drop-shadow(0 0 calc(7px * var(--ot-glow)) rgba(var(--ot-fg), .45)); }
.ot-orbit .ot-ac { --ot-rw: 1.75px; opacity: 0;
  background: conic-gradient(from -70deg, var(--ot-ac), color-mix(in srgb, var(--ot-ac) 55%, transparent) 25%, color-mix(in srgb, var(--ot-ac) 22%, transparent) 50%, color-mix(in srgb, var(--ot-ac) 55%, transparent) 75%, var(--ot-ac));
  filter: drop-shadow(0 0 calc(9px * var(--ot-glow)) var(--ot-ac)) drop-shadow(0 0 calc(2px * var(--ot-glow)) var(--ot-ac)); }
.ot-root[data-theme="light"] .ot-orbit .ot-ln { background: conic-gradient(from -70deg, rgba(var(--ot-fg), .08), rgba(var(--ot-fg), .18) 25%, rgba(var(--ot-fg), .33) 50%, rgba(var(--ot-fg), .18) 75%, rgba(var(--ot-fg), .08));
  filter: drop-shadow(0 -.5px 0 rgba(255,255,255,.95)) drop-shadow(0 1px 1.5px rgba(0,0,0,.09)); }
.ot-root[data-theme="light"] .ot-orbit .ot-ac { background: var(--ot-ac); filter: drop-shadow(0 0 3px color-mix(in srgb, var(--ot-ac) 60%, transparent)); }
.ot-orbit.ot-on .ot-ac { opacity: 1; }
.ot-orbit.ot-on .ot-ln { opacity: 0; }
.ot-root.ot-focus .ot-orbit:not(.ot-on) .ot-ln { opacity: .35; }
.ot-orbit.ot-hidden { --ot-s: .2; --ot-o: 0; }

.ot-year { position: absolute; transform: translate(-50%, -50%); white-space: nowrap; cursor: pointer; background: none; border: 0; padding: 2px 4px; margin: 0;
  font: 300 12px/1 var(--ot-year-font); letter-spacing: .12em; font-variant-numeric: lining-nums tabular-nums;
  color: rgba(var(--ot-fg), .6); transition: color .35s, opacity .6s; z-index: 2; }
.ot-year:hover { color: rgba(var(--ot-fg), .9); }
.ot-year:focus-visible, .ot-node:focus-visible, .ot-card button:focus-visible { outline: 2px solid rgba(var(--ot-fg), .6); outline-offset: 2px; }
.ot-year.ot-on { color: var(--ot-ac); text-shadow: 0 0 4px color-mix(in srgb, var(--ot-ac) 45%, transparent); }
.ot-root.ot-focus .ot-year:not(.ot-on) { color: rgba(var(--ot-fg), .22); }
.ot-year.ot-hidden { opacity: 0; }
.ot-root.ot-no-years .ot-year { display: none; }

.ot-core { position: absolute; left: 50%; top: 50%; border-radius: 50%; z-index: 1; animation: ot-breathe 5s ease-in-out infinite; }
.ot-core-fill { position: absolute; inset: 0; border-radius: 50%; overflow: hidden; isolation: isolate; background: var(--ot-o2); }
.ot-blob { position: absolute; width: 70%; height: 70%; border-radius: 50%; filter: blur(calc(var(--ot-cs, 28px) * .14)); will-change: transform; }
.ot-b1 { background: var(--ot-o1); left: -5%; top: -10%; animation: ot-d1 9s ease-in-out infinite; }
.ot-b2 { background: var(--ot-o2); right: -10%; top: 10%; animation: ot-d2 11s ease-in-out infinite; }
.ot-b3 { background: var(--ot-o3); left: 15%; bottom: -15%; animation: ot-d3 8s ease-in-out infinite; }
.ot-b4 { background: #fff; width: 36%; height: 36%; left: 28%; top: 26%; opacity: .18; animation: ot-d4 7s ease-in-out infinite; }
.ot-core-gloss { position: absolute; inset: 0; border-radius: 50%; pointer-events: none; background: radial-gradient(circle at 32% 26%, rgba(255,255,255,.5) 0, rgba(255,255,255,0) 34%); }
.ot-core-shine { position: absolute; left: 18%; top: 9%; width: 40%; height: 26%; border-radius: 50%; transform: rotate(-20deg); filter: blur(1.5px); opacity: .35;
  background: radial-gradient(ellipse at 50% 35%, rgba(255,255,255,.8) 0, rgba(255,255,255,.2) 50%, rgba(255,255,255,0) 75%); }
.ot-emit { position: absolute; left: 50%; top: 50%; width: var(--ot-rr); height: var(--ot-rr); border-radius: 50%; pointer-events: none; z-index: 1;
  transform: translate(-50%, -50%); border: 1px solid rgba(var(--ot-fg), .55); opacity: 0; animation: ot-emit 4.2s cubic-bezier(.25,.6,.35,1) infinite; }
.ot-emit-2 { animation-delay: 1.4s; } .ot-emit-3 { animation-delay: 2.8s; }
@keyframes ot-emit { 0% { --ot-rr: var(--ot-from); opacity: 0; } 30% { opacity: .38; } 75% { opacity: .08; } 100% { --ot-rr: var(--ot-to); opacity: 0; } }
@keyframes ot-breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.03); } }
@keyframes ot-d1 { 0%,100% { transform: translate(0,0) scale(1); } 33% { transform: translate(30%, 25%) scale(1.2); } 66% { transform: translate(10%, 45%) scale(.9); } }
@keyframes ot-d2 { 0%,100% { transform: translate(0,0) scale(1); } 33% { transform: translate(-35%, 30%) scale(1.1); } 66% { transform: translate(-15%, -10%) scale(1.3); } }
@keyframes ot-d3 { 0%,100% { transform: translate(0,0) scale(1); } 33% { transform: translate(25%, -40%) scale(1.15); } 66% { transform: translate(-20%, -20%) scale(.95); } }
@keyframes ot-d4 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-25%, -30%) scale(1.3); } }

.ot-node { position: absolute; left: 0; top: 0; width: 30px; height: 30px; margin: -15px 0 0 -15px; border-radius: 50%; border: 0; padding: 0;
  display: grid; place-items: center; cursor: pointer; z-index: 3; color: rgba(var(--ot-fg), .85);
  --ot-ring: conic-gradient(from -70deg, rgba(var(--ot-fg), .55), rgba(var(--ot-fg), .2) 25%, rgba(var(--ot-fg), .08) 50%, rgba(var(--ot-fg), .2) 75%, rgba(var(--ot-fg), .55));
  background: rgba(18, 20, 26, .5); -webkit-backdrop-filter: blur(6px) saturate(1.2); backdrop-filter: blur(6px) saturate(1.2);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.06);
  transition: color .3s, opacity .35s, box-shadow .3s, background .3s, --ot-k .3s cubic-bezier(.2,.8,.2,1); }
.ot-node::before { content: ""; position: absolute; inset: 0; border-radius: 50%; pointer-events: none; background: var(--ot-ring); transition: opacity .3s;
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 1.1px), #000 calc(100% - .85px)); mask: radial-gradient(farthest-side, transparent calc(100% - 1.1px), #000 calc(100% - .85px)); }
.ot-root[data-theme="light"] .ot-node { color: rgba(var(--ot-fg), .8); background: rgba(255,255,255,.55);
  --ot-ring: conic-gradient(from -70deg, rgba(var(--ot-fg), .1), rgba(var(--ot-fg), .2) 25%, rgba(var(--ot-fg), .36) 50%, rgba(var(--ot-fg), .2) 75%, rgba(var(--ot-fg), .1));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.95), 0 1px 2px rgba(0,0,0,.05), 0 6px 14px -8px rgba(0,0,0,.14); }
.ot-node svg { width: 14px; height: 14px; position: relative; stroke: var(--ot-ig); stroke-width: 1.5; fill: none; }
.ot-node .ot-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; position: relative; }
.ot-node:hover { color: rgba(var(--ot-fg), 1); }
.ot-node:hover::before { filter: brightness(1.6); }
.ot-root .ot-node.ot-on { color: var(--ot-ac); --ot-ring: var(--ot-ac); }
.ot-node.ot-on svg, .ot-node.ot-sel svg { stroke: currentColor; }
.ot-root.ot-focus .ot-node:not(.ot-on) { opacity: .28; }
.ot-root .ot-node.ot-sel { --ot-k: 1.3; background: var(--ot-ac); color: var(--ot-on-ac); --ot-ring: var(--ot-ac);
  box-shadow: 0 0 0 6px color-mix(in srgb, var(--ot-ac) 14%, transparent), 0 0 14px color-mix(in srgb, var(--ot-ac) 45%, transparent); }
.ot-root[data-theme="light"] .ot-node.ot-sel { box-shadow: 0 0 0 6px color-mix(in srgb, var(--ot-ac) 10%, transparent), 0 8px 18px -8px rgba(0,0,0,.35); }
.ot-node.ot-hidden { opacity: 0 !important; --ot-k: .4; }

.ot-card { position: absolute; left: 0; top: 0; width: 268px; padding: 16px 16px 14px; border-radius: 14px; z-index: 4; text-align: left;
  background: color-mix(in srgb, var(--ot-bg) 78%, transparent); -webkit-backdrop-filter: blur(16px) saturate(1.3); backdrop-filter: blur(16px) saturate(1.3);
  border: 1px solid rgba(var(--ot-fg), .12); box-shadow: 0 24px 60px -24px rgba(0,0,0,.6);
  opacity: 0; transform: translateY(6px) scale(.98); pointer-events: none; transition: opacity .25s, transform .3s cubic-bezier(.2,.8,.2,1); }
.ot-card.ot-open { opacity: 1; transform: none; pointer-events: auto; }
.ot-card-meta { display: flex; justify-content: space-between; gap: 12px; font: 500 10.5px/1 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .1em; text-transform: uppercase; color: var(--ot-ac); }
.ot-card-meta span:last-child { color: rgba(var(--ot-fg), .4); }
.ot-card-title { margin: 10px 0 6px; font-size: 17px; line-height: 1.25; font-weight: 650; letter-spacing: -.01em; color: rgb(var(--ot-fg)); }
.ot-card-text { margin: 0; font-size: 13px; line-height: 1.5; color: rgba(var(--ot-fg), .62); }
.ot-card-nav { display: flex; gap: 6px; margin-top: 14px; }
.ot-card-nav button { appearance: none; flex: 1; border: 1px solid rgba(var(--ot-fg), .14); background: transparent; color: rgba(var(--ot-fg), .75);
  font: inherit; font-size: 12px; font-weight: 600; padding: 6px 8px; border-radius: 8px; cursor: pointer; }
.ot-card-nav button:hover { border-color: rgba(var(--ot-fg), .35); color: rgb(var(--ot-fg)); }
@media (prefers-reduced-motion: reduce) { .ot-core, .ot-core *, .ot-emit { animation: none !important; } .ot-emit { display: none; } }
`;

function useStyles() {
  React.useInsertionEffect?.(() => {
    if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = CSS;
    document.head.appendChild(el);
  }, []);
}

type Flat = { yi: number; ei: number; a0: number };

export function OrbitTimeline({
  data,
  theme = "dark",
  showYears = true,
  speed = 1,
  direction = "same",
  intro = true,
  replayKey = 0,
  yearFont = '"Geist", ui-sans-serif, system-ui, -apple-system, sans-serif',
  onSelect,
  className,
  style,
}: OrbitTimelineProps) {
  useStyles();
  const uid = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const gradId = `ot-ig-${uid}`;

  const flat = React.useMemo<Flat[]>(() => {
    const out: Flat[] = [];
    data.forEach((y, yi) => {
      const n = Math.max(1, y.events.length);
      y.events.forEach((_, ei) => out.push({ yi, ei, a0: yi * 1.3 + 0.4 + ei * ((Math.PI * 2) / n) }));
    });
    return out;
  }, [data]);

  const [sel, setSel] = React.useState(-1);
  const [hover, setHover] = React.useState(-1);
  const [shown, setShown] = React.useState(intro ? 0 : data.length);
  const [nodesShown, setNodesShown] = React.useState(intro ? 0 : data.length);

  const root = React.useRef<HTMLDivElement>(null);
  const card = React.useRef<HTMLDivElement>(null);
  const core = React.useRef<HTMLDivElement>(null);
  const orbitEls = React.useRef<(HTMLDivElement | null)[]>([]);
  const yearEls = React.useRef<(HTMLButtonElement | null)[]>([]);
  const nodeEls = React.useRef<(HTMLButtonElement | null)[]>([]);
  const emitEls = React.useRef<(HTMLElement | null)[]>([]);

  // Live values read by the animation loop without re-rendering.
  const live = React.useRef({ speed, direction, sel, hover, showYears });
  live.current = { speed, direction, sel, hover, showYears };
  const geo = React.useRef({ w: 0, h: 0, cx: 0, cy: -1, cyBase: 0, cyUp: 0, narrow: false, r: [] as number[] });

  const placeY = React.useCallback(() => {
    const g = geo.current;
    orbitEls.current.forEach((el, i) => { if (el) el.style.top = g.cy + "px"; });
    yearEls.current.forEach((el, i) => { if (el) el.style.top = g.cy - (g.r[i] ?? 0) + "px"; });
    if (core.current) core.current.style.top = g.cy + "px";
    emitEls.current.forEach((el) => { if (el) el.style.top = g.cy + "px"; });
  }, []);

  const placeGaps = React.useCallback(() => {
    const g = geo.current, k = 180 / Math.PI, off = !live.current.showYears;
    orbitEls.current.forEach((el, i) => {
      if (!el) return;
      const r = g.r[i] || 1, hw = (yearEls.current[i]?.offsetWidth ?? 0) / 2;
      el.style.setProperty("--ot-g0", off ? "0deg" : ((hw + 1) / r) * k + "deg");
      el.style.setProperty("--ot-g1", off ? "0deg" : ((hw + 18) / r) * k + "deg");
    });
  }, []);

  const layout = React.useCallback(() => {
    const el = root.current;
    if (!el) return;
    const g = geo.current, w = el.clientWidth, h = el.clientHeight, m = Math.min(w, h), n = data.length;
    g.w = w; g.h = h; g.cx = w / 2; g.cyBase = h / 2; g.cyUp = Math.min(h / 2, w * 0.5 + 24); g.narrow = w < 640;
    if (g.cy < 0) g.cy = g.cyBase;
    const r0 = Math.max(58, m * 0.11), r1 = m * 0.46;
    g.r = data.map((_, i) => (n > 1 ? r0 + ((r1 - r0) * i) / (n - 1) : r1));
    orbitEls.current.forEach((o, i) => { if (o) { o.style.width = o.style.height = g.r[i] * 2 + "px"; } });
    yearEls.current.forEach((y) => { if (y) y.style.left = g.cx + "px"; });
    const cd = Math.round(Math.min(28, (g.r[0] ?? 60) * 0.42));
    if (core.current) {
      core.current.style.width = core.current.style.height = cd + "px";
      core.current.style.margin = `${-cd / 2}px 0 0 ${-cd / 2}px`;
      core.current.style.setProperty("--ot-cs", cd + "px");
    }
    emitEls.current.forEach((e) => {
      if (!e) return;
      e.style.setProperty("--ot-from", cd + 2 + "px");
      e.style.setProperty("--ot-to", (g.r[0] ?? 60) * 2 - 14 + "px");
    });
    placeGaps();
    placeY();
  }, [data, placeGaps, placeY]);

  React.useLayoutEffect(() => {
    layout();
    const ro = new ResizeObserver(layout);
    if (root.current) ro.observe(root.current);
    document.fonts?.ready.then(placeGaps).catch(() => {});
    return () => ro.disconnect();
  }, [layout, placeGaps]);

  React.useEffect(() => { placeGaps(); }, [showYears, placeGaps]);

  // Growth intro: years appear from the centre outward, their events right after.
  React.useEffect(() => {
    if (!intro && replayKey === 0) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setSel(-1);
    setShown(0); setNodesShown(0);
    const timers: number[] = [];
    data.forEach((_, i) => {
      const at = reduce ? 0 : 200 + i * 230;
      timers.push(window.setTimeout(() => setShown((s) => Math.max(s, i + 1)), at));
      timers.push(window.setTimeout(() => setNodesShown((s) => Math.max(s, i + 1)), at + (reduce ? 0 : 380)));
    });
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayKey, data.length]);

  // Orbit animation and card placement.
  React.useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, last = 0, t = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
      const L = live.current, g = geo.current;
      if (L.sel < 0 && L.hover < 0 && !reduce) t += dt * L.speed;
      const ty = g.narrow && L.sel >= 0 ? g.cyUp : g.cyBase;
      if (Math.abs(ty - g.cy) > 0.3) { g.cy += (ty - g.cy) * Math.min(1, dt * 8); placeY(); }
      let sx = 0, sy = 0;
      flat.forEach((f, i) => {
        const el = nodeEls.current[i]; if (!el) return;
        const r = g.r[f.yi] ?? 0, dir = L.direction === "alternate" && f.yi % 2 ? -1 : 1;
        const a = f.a0 + dir * t * ((0.16 * (g.r[0] ?? r)) / (r || 1));
        const x = g.cx + r * Math.cos(a), y = g.cy + r * Math.sin(a);
        el.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(var(--ot-k))`;
        if (i === L.sel) { sx = x; sy = y; }
      });
      const c = card.current;
      if (c && L.sel >= 0) {
        let x: number, y: number;
        if (g.narrow) { c.style.width = g.w - 24 + "px"; x = 12; y = g.h - c.offsetHeight - 12; }
        else {
          c.style.width = "";
          const cw = c.offsetWidth, ch = c.offsetHeight;
          x = sx >= g.cx ? sx + 34 : sx - 34 - cw;
          if (x + cw > g.w - 12) x = sx - 34 - cw;
          if (x < 12) x = Math.min(g.w - cw - 12, sx + 34);
          y = Math.max(12, Math.min(g.h - ch - 12, sy - ch / 2));
        }
        c.style.transform = "";
        c.style.left = x + "px"; c.style.top = y + "px";
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [flat, placeY]);

  const select = React.useCallback((i: number) => {
    setSel(i);
    if (!onSelect) return;
    if (i < 0) onSelect(null);
    else { const f = flat[i]; onSelect({ year: data[f.yi], event: data[f.yi].events[f.ei], index: i }); }
  }, [flat, data, onSelect]);

  const step = (d: number) => select((sel + d + flat.length) % flat.length);
  const activeYear = sel >= 0 ? flat[sel]?.yi ?? -1 : hover;
  const current = sel >= 0 ? flat[sel] : null;
  const curYear = current ? data[current.yi] : null;
  const curEvent = current && curYear ? curYear.events[current.ei] : null;
  const pad = (n: number) => String(n).padStart(2, "0");

  const rootStyle = {
    ...style,
    ["--ot-ig" as string]: `url(#${gradId})`,
    ["--ot-year-font" as string]: yearFont,
  } as React.CSSProperties;

  return (
    <div
      ref={root}
      data-theme={theme}
      role="region"
      aria-label="Timeline"
      className={["ot-root", activeYear >= 0 ? "ot-focus" : "", showYears ? "" : "ot-no-years", className].filter(Boolean).join(" ")}
      style={rootStyle}
      onClick={() => select(-1)}
      onKeyDown={(e) => {
        if (sel < 0) return;
        if (e.key === "ArrowRight") step(1);
        else if (e.key === "ArrowLeft") step(-1);
        else if (e.key === "Escape") select(-1);
      }}
    >
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="2" y1="2" x2="22" y2="22">
            <stop offset="0" stopColor={theme === "dark" ? "rgba(255,255,255,.95)" : "rgba(23,23,26,.5)"} />
            <stop offset="1" stopColor={theme === "dark" ? "rgba(255,255,255,.4)" : "rgba(23,23,26,.95)"} />
          </linearGradient>
        </defs>
      </svg>

      {data.map((y, i) => (
        <div
          key={`o${i}`}
          ref={(el) => { orbitEls.current[i] = el; }}
          className={["ot-orbit", i === activeYear ? "ot-on" : "", i >= shown ? "ot-hidden" : ""].join(" ")}
        >
          <i className="ot-ln" />
          <i className="ot-ac" />
        </div>
      ))}

      {data.map((y, i) => (
        <button
          key={`y${i}`}
          type="button"
          ref={(el) => { yearEls.current[i] = el; }}
          className={["ot-year", i === activeYear ? "ot-on" : "", i >= shown ? "ot-hidden" : ""].join(" ")}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(-1)}
          onClick={(e) => { e.stopPropagation(); const first = flat.findIndex((f) => f.yi === i); if (first >= 0) select(first); }}
        >
          {y.year}
        </button>
      ))}

      <i className="ot-emit" ref={(el) => { emitEls.current[0] = el; }} />
      <i className="ot-emit ot-emit-2" ref={(el) => { emitEls.current[1] = el; }} />
      <i className="ot-emit ot-emit-3" ref={(el) => { emitEls.current[2] = el; }} />
      <div className="ot-core" ref={core} aria-hidden="true">
        <div className="ot-core-fill">
          <div className="ot-blob ot-b1" />
          <div className="ot-blob ot-b2" />
          <div className="ot-blob ot-b3" />
          <div className="ot-blob ot-b4" />
        </div>
        <div className="ot-core-gloss" />
        <div className="ot-core-shine" />
      </div>

      {flat.map((f, i) => {
        const y = data[f.yi], ev = y.events[f.ei];
        return (
          <button
            key={`n${i}`}
            type="button"
            ref={(el) => { nodeEls.current[i] = el; }}
            aria-label={`${ev.title}, ${ev.date ? ev.date + " " : ""}${y.year}`}
            aria-pressed={i === sel}
            className={["ot-node", f.yi === activeYear ? "ot-on" : "", i === sel ? "ot-sel" : "", f.yi >= nodesShown ? "ot-hidden" : ""].join(" ")}
            onMouseEnter={() => setHover(f.yi)}
            onMouseLeave={() => setHover(-1)}
            onClick={(e) => { e.stopPropagation(); select(sel === i ? -1 : i); }}
          >
            {ev.icon ?? <span className="ot-dot" />}
          </button>
        );
      })}

      <div
        ref={card}
        role="dialog"
        aria-live="polite"
        aria-hidden={!curEvent}
        className={["ot-card", curEvent ? "ot-open" : ""].join(" ")}
        onClick={(e) => e.stopPropagation()}
      >
        {curEvent && curYear && (
          <>
            <div className="ot-card-meta">
              <span>{curEvent.date ? `${curEvent.date} ${curYear.year}` : curYear.year}</span>
              <span>{pad(sel + 1)} / {pad(flat.length)}</span>
            </div>
            <h4 className="ot-card-title">{curEvent.title}</h4>
            {curEvent.description && <p className="ot-card-text">{curEvent.description}</p>}
            <div className="ot-card-nav">
              <button type="button" onClick={() => step(-1)}>← Prev</button>
              <button type="button" onClick={() => step(1)}>Next →</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default OrbitTimeline;

demo.tsx
"use client";

import * as React from "react";
import { Award, Building2, Code2, Coins, Flag, Globe, Rocket, Smartphone, Sparkles, Users } from "lucide-react";
import { OrbitTimeline, type OrbitTimelineYear } from "@/components/ui/orbit-timeline";

const DATA: OrbitTimelineYear[] = [
  { year: 2021, events: [{ date: "Apr", icon: <Rocket />, title: "Company founded", description: "Three people, one room and a prototype that barely worked." }] },
  {
    year: 2022,
    events: [
      { date: "Feb", icon: <Users />, title: "First 10 clients", description: "Signed without a sales team — all from referrals." },
      { date: "Oct", icon: <Coins />, title: "Seed round", description: "$1.2M raised to turn the prototype into a product." },
    ],
  },
  {
    year: 2023,
    events: [
      { date: "Mar", icon: <Code2 />, title: "Product v2", description: "Rebuilt from scratch: 4× faster and fully self-serve." },
      { date: "Sep", icon: <Users />, title: "Team of 25", description: "Engineering, design and support under one roof." },
    ],
  },
  {
    year: 2024,
    events: [
      { date: "Jan", icon: <Smartphone />, title: "Mobile app", description: "iOS and Android launch, 20k installs in the first month." },
      { date: "Jun", icon: <Building2 />, title: "New HQ", description: "Moved into a studio built around how the team works." },
      { date: "Nov", icon: <Coins />, title: "Series A", description: "$9M led by a top-tier fund." },
    ],
  },
  {
    year: 2025,
    events: [
      { date: "Mar", icon: <Globe />, title: "Global launch", description: "Opened offices in Dubai and Singapore. Revenue doubled within the year." },
      { date: "Jul", icon: <Sparkles />, title: "AI assistant", description: "Shipped the assistant that now handles 60% of requests." },
      { date: "Nov", icon: <Award />, title: "Design award", description: "Recognised for product of the year." },
    ],
  },
  { year: 2026, events: [{ date: "Feb", icon: <Flag />, title: "1M users", description: "One million people use the product every month." }] },
];

const BAR_CSS = `
.otd { display: flex; flex-direction: column; width: 100%; height: 100%; min-height: 640px; background: #0b0d12; color: #e8eaf0;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
.otd-stage { flex: 1; min-height: 0; position: relative; }
.otd-bar { flex: none; border-top: 1px solid #1f2330; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0 28px; padding: 12px 16px; }
.otd-bar.is-collapsed .otd-col { display: none; }
.otd-head { grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.otd-head b { font-size: 13px; font-weight: 700; }
.otd-head small { margin-left: 8px; color: #6b7187; font: 11px ui-monospace, Menlo, monospace; }
.otd-col { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.otd-col h3 { margin: 0 0 2px; padding-bottom: 6px; border-bottom: 1px solid #1f2330; font: 600 11px ui-monospace, Menlo, monospace; letter-spacing: .12em; text-transform: uppercase; color: #6b7187; }
.otd-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 12px; color: #9aa0b4; }
.otd-row > span:first-child { min-width: 78px; }
.otd-seg { display: flex; gap: 2px; background: #161925; border-radius: 10px; padding: 3px; }
.otd-seg button { appearance: none; border: 0; background: transparent; color: #9aa0b4; font-size: 12px; font-weight: 600; font-family: inherit; padding: 5px 10px; border-radius: 8px; cursor: pointer; }
.otd-seg button[aria-pressed="true"] { background: #2a2f44; color: #fff; }
.otd-btn { appearance: none; border: 1px solid #2a2f44; background: #161925; color: #e8eaf0; font-size: 12px; font-weight: 600; font-family: inherit; padding: 6px 10px; border-radius: 8px; cursor: pointer; }
.otd-bar button:focus-visible { outline: 2px solid #7aa2ff; outline-offset: 1px; }
.otd-row input[type=range] { flex: 1; min-width: 80px; max-width: 180px; accent-color: #7aa2ff; }
.otd-val { font: 12px ui-monospace, Menlo, monospace; color: #6b7187; min-width: 4ch; }
@media (max-width: 900px) { .otd-bar { grid-template-columns: 1fr; gap: 14px; max-height: 60vh; overflow-y: auto; } }
`;

function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="otd-row">
      <span>{label}</span>
      <div className="otd-seg" role="group" aria-label={label}>
        {options.map(([v, text]) => (
          <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{text}</button>
        ))}
      </div>
    </div>
  );
}

export default function OrbitTimelineDemo() {
  const [theme, setTheme] = React.useState<"dark" | "light">("light");
  const [years, setYears] = React.useState<"on" | "off">("on");
  const [speed, setSpeed] = React.useState(1);
  const [direction, setDirection] = React.useState<"same" | "alternate">("same");
  const [replay, setReplay] = React.useState(0);
  const [collapsed, setCollapsed] = React.useState(true);

  React.useEffect(() => {
    if (document.getElementById("otd-geist")) return;
    const link = document.createElement("link");
    link.id = "otd-geist";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Geist:wght@300&display=swap";
    document.head.appendChild(link);
  }, []);

  return (
    <div className="otd">
      <style>{BAR_CSS}</style>
      <div className="otd-stage">
        <OrbitTimeline
          data={DATA}
          theme={theme}
          showYears={years === "on"}
          speed={speed}
          direction={direction}
          replayKey={replay}
          style={{ position: "absolute", inset: 0, minHeight: 0 }}
        />
      </div>

      <div className={`otd-bar${collapsed ? " is-collapsed" : ""}`}>
        <div className="otd-head">
          <div><b>Orbit Timeline</b><small>demo controls</small></div>
          <button type="button" className="otd-btn" aria-expanded={!collapsed} onClick={() => setCollapsed((c) => !c)}>
            {collapsed ? "Show controls" : "Hide controls"}
          </button>
        </div>
        <section className="otd-col">
          <h3>Preview</h3>
          <Seg label="Theme" value={theme} onChange={setTheme} options={[["dark", "Dark"], ["light", "Light"]]} />
          <div className="otd-row"><span>Intro</span><button type="button" className="otd-btn" onClick={() => setReplay((r) => r + 1)}>Replay growth</button></div>
        </section>
        <section className="otd-col">
          <h3>Appearance</h3>
          <Seg label="Year labels" value={years} onChange={setYears} options={[["on", "On"], ["off", "Off"]]} />
        </section>
        <section className="otd-col">
          <h3>Motion</h3>
          <label className="otd-row">
            <span>Orbit speed</span>
            <input type="range" min={0} max={300} value={Math.round(speed * 100)} onChange={(e) => setSpeed(Number(e.target.value) / 100)} aria-label="Orbit speed" />
            <span className="otd-val">{speed.toFixed(1)}×</span>
          </label>
          <Seg label="Direction" value={direction} onChange={setDirection} options={[["same", "Same"], ["alternate", "Alternate"]]} />
        </section>
      </div>
    </div>
  );
}
```

Implementation Guidelines
 1. Analyze the component structure and identify all required dependencies
 2. Review the component's argumens and state
 3. Identify any required context providers or hooks and install them
 4. Questions to Ask
 - What data/props will be passed to this component?
 - Are there any specific state management requirements?
 - Are there any required assets (images, icons, etc.)?
 - What is the expected responsive behavior?
 - What is the best place to use this component in the app?

Steps to integrate
 0. Copy paste all the code above in the correct directories
 1. Install external dependencies
 2. Fill image assets with Unsplash stock images you know exist
 3. Use lucide-react icons for svgs or logos if component requires them
