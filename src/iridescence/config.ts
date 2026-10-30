import type { IridescenceConfig } from './types';

/**
 * 炫彩遮罩的默认配置。
 *
 * 这是唯一需要修改的地方：换主题改 palette，改大小改 size，
 * 改外形改 shape 与 radius，改流动速度改 spinDuration。
 *
 * 使用示例：
 *   import { mountIridescence } from './iridescence';
 *   mountIridescence({ palette: ['#f0f', '#08f', '#f00'] });
 * 或直接改本文件里的 DEFAULT_CONFIG。
 */
export const DEFAULT_CONFIG: IridescenceConfig = {
  /* ── 形状与尺寸 ───────────────────────────── */
  size: '4cm',
  shape: 'circle',
  radius: '0',
  feather: 0.32,

  /* ── 颜色 ─────────────────────────────────── */
  // 主色带，沿圆周循环
  palette: ['#eeeef2', '#9d5cf5', '#3f7df0', '#ff4d4d', '#f5f0f7'],
  // 第二层色带，省略时由 palette 自动派生
  paletteAlt: ['#eeeef2', '#ff4d4d', '#3f7df0', '#9d5cf5', '#f5f0f7'],
  // 各色在圆周上的位置（0~1），省略则按颜色数量均分
  stops: undefined,
  phaseAlt: 180,

  /* ── 混合 ─────────────────────────────────── */
  blendMode: 'lighten',
  // 通道封顶：lighten 下这是浅色底零变化的保证
  maxChannel: 242,

  /* ── 质感 ─────────────────────────────────── */
  opacity: 1,
  altOpacity: 0.6,
  blur: 8,
  bleed: 0.5,

  /* ── 动效 ─────────────────────────────────── */
  spinDuration: 9,
  spinDurationAlt: 13,
  damping: 0.25,

  /* ── 环境 ─────────────────────────────────── */
  zIndex: 5,
  requireFinePointer: true,
  respectReducedMotion: true,
};
