import type { IridescenceConfig } from './types';

/**
 * 把配置编译成 CSS。
 *
 * 样式表是静态的（所有实例共用一份），随配置变化的部分全部走
 * CSS 自定义属性，由每个实例以内联样式写在自己的元素上。
 * 这样多个实例可以并存、各自配置互不干扰，卸载后重挂也不会串配置。
 */

/** 把任意 CSS 颜色转成 [r, g, b]，无法解析时返回 null */
function parseColor(input: string): [number, number, number] | null {
  const s = input.trim().toLowerCase();

  // #rgb
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(s);
  if (short) {
    return [
      parseInt(short[1] + short[1], 16),
      parseInt(short[2] + short[2], 16),
      parseInt(short[3] + short[3], 16),
    ];
  }

  // #rrggbb
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/.exec(s);
  if (long) {
    return [parseInt(long[1], 16), parseInt(long[2], 16), parseInt(long[3], 16)];
  }

  // rgb() / rgba()
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(s);
  if (rgb) {
    return [Math.round(+rgb[1]), Math.round(+rgb[2]), Math.round(+rgb[3])];
  }

  return null;
}

/**
 * 按通道上限压缩颜色。
 *
 * 这是「只作用黑色」的关键：lighten 的结果是 max(底色, 叠加色)，
 * 叠加色一旦比页面背景亮，浅色区域就会被抬亮。把通道压到
 * maxChannel 以下，浅色底就是数学上的零变化。
 */
export function clampColor(color: string, maxChannel: number | null): string {
  if (maxChannel === null) return color;
  const rgb = parseColor(color);
  if (!rgb) return color;
  const [r, g, b] = rgb.map((c) => Math.min(c, maxChannel)) as [number, number, number];
  return `rgb(${r} ${g} ${b})`;
}

/** 计算各颜色在圆周上的位置（0~1） */
function resolveStops(palette: string[], stops?: number[]): number[] {
  if (stops && stops.length === palette.length) return stops;
  const n = palette.length;
  return palette.map((_, i) => i / n);
}

/** 由色带与色标生成 conic-gradient */
function buildConic(palette: string[], stops: number[], phase: number, maxChannel: number | null): string {
  const parts = palette.map((color, i) => {
    const clamped = clampColor(color, maxChannel);
    return `${clamped} ${(stops[i] * 360).toFixed(2)}deg`;
  });
  return `conic-gradient(from ${phase}deg, ${parts.join(', ')})`;
}

/** 由形状与淡出参数生成遮罩（mask） */
function buildMask(shape: IridescenceConfig['shape'], feather: number): string {
  if (feather <= 0) return 'none';
  const inner = (feather * 100).toFixed(1);
  const kind = shape === 'circle' ? 'circle' : 'ellipse';
  return `radial-gradient(${kind} closest-side at 50% 50%, #000 ${inner}%, transparent 100%)`;
}

/** 静态样式表，所有实例共用 */
export const STYLE_SHEET = `
.irid-veil {
  position: fixed;
  top: 0;
  left: 0;
  width: var(--irid-size);
  height: var(--irid-size);
  z-index: var(--irid-z);
  pointer-events: none;
  overflow: hidden;
  border-radius: var(--irid-radius);
  opacity: 0;
  mix-blend-mode: var(--irid-blend);
  transition: opacity 0.18s ease;
  will-change: transform;
  -webkit-mask-image: var(--irid-mask);
  mask-image: var(--irid-mask);
}

.irid-veil.is-on {
  opacity: var(--irid-opacity);
}

/* 被外部抑制时整体淡出。
   悬停的黑面是遮罩唯一能生效的区域（白色面与浅灰底都是零变化），
   所以整体隐藏在视觉上等于「只在 hover 区域让遮罩退场」。 */
.irid-veil.is-suppressed {
  opacity: 0;
}

.irid-veil__flow {
  position: absolute;
  inset: calc(var(--irid-bleed) * -100%);
  background: var(--irid-grad);
  filter: blur(var(--irid-blur));
  animation: irid-spin var(--irid-spin) linear infinite;
}

.irid-veil__flow.is-alt {
  background: var(--irid-grad-alt);
  opacity: var(--irid-alt-opacity);
  animation-duration: var(--irid-spin-alt);
  animation-direction: reverse;
}

@keyframes irid-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .irid-veil__flow { animation: none !important; }
}
`.trim();

/** 实例级 CSS 自定义属性 */
export type StyleVars = Record<string, string>;

/**
 * 把配置编译成实例的 CSS 自定义属性。
 *
 * 键统一带 --irid- 前缀，写在遮罩元素上，由子元素继承。
 */
export function compileVars(config: IridescenceConfig): StyleVars {
  const stops = resolveStops(config.palette, config.stops);
  const altPalette = config.paletteAlt ?? config.palette;

  const borderRadius =
    config.shape === 'circle' ? '50%' : config.shape === 'rounded' ? config.radius : config.radius;

  return {
    '--irid-size': config.size,
    '--irid-radius': borderRadius,
    '--irid-mask': buildMask(config.shape, config.feather),
    '--irid-grad': buildConic(config.palette, stops, 0, config.maxChannel),
    '--irid-grad-alt': buildConic(altPalette, stops, config.phaseAlt, config.maxChannel),
    '--irid-blend': config.blendMode,
    '--irid-z': String(config.zIndex),
    '--irid-opacity': String(config.opacity),
    '--irid-alt-opacity': String(config.altOpacity),
    '--irid-blur': `${config.blur}px`,
    '--irid-bleed': String(config.bleed),
    '--irid-spin': `${config.spinDuration}s`,
    '--irid-spin-alt': `${config.spinDurationAlt}s`,
  };
}
