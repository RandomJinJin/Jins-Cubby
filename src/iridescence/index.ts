import { DEFAULT_CONFIG } from './config';
import { compileVars, STYLE_SHEET } from './style';
import type { IridescenceConfig, IridescenceHandle, IridescenceOptions } from './types';

export { DEFAULT_CONFIG } from './config';
export { clampColor } from './style';
export type {
  IridescenceConfig,
  IridescenceOptions,
  IridescenceShape,
  IridescenceBlendMode,
  IridescenceHandle,
} from './types';

/** 触摸设备没有悬停概念，直接不挂载，避免无意义的合成开销 */
const FINE_POINTER = '(hover: hover) and (pointer: fine)';

/** 注入样式的 <style> 标记，多实例共享同一份静态样式表 */
const STYLE_ID = 'irid-veil-styles';

function resolveConfig(options?: IridescenceOptions): IridescenceConfig {
  return { ...DEFAULT_CONFIG, ...options };
}

/** 注入一次静态样式表，已存在则跳过 */
function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLE_SHEET;
  document.head.appendChild(style);
}

/**
 * 挂载炫彩遮罩。
 *
 * 遮罩是一个跟随光标的固定元素，用 mix-blend-mode 混合，
 * 因此只染原本偏暗的像素，浅色区域与模型原有配色保持不变。
 *
 * 每次调用都会创建独立的实例，配置互不影响；可重复调用。
 *
 * @param options 覆盖默认配置，常用项为 palette / size / shape
 * @returns 卸载函数
 *
 * @example
 * import { mountIridescence } from './iridescence';
 * const unmount = mountIridescence({ palette: ['#f0f', '#08f', '#f00'] });
 */
export function mountIridescence(options?: IridescenceOptions): IridescenceHandle {
  const config = resolveConfig(options);

  if (config.requireFinePointer && !window.matchMedia(FINE_POINTER).matches) {
    return createNoopHandle();
  }

  injectStyles();

  const veil = document.createElement('div');
  veil.className = 'irid-veil';
  veil.setAttribute('aria-hidden', 'true');

  // 配置写入实例自己的 CSS 变量，多实例并存时互不干扰
  const vars = compileVars(config);
  for (const [key, value] of Object.entries(vars)) {
    veil.style.setProperty(key, value);
  }

  const main = document.createElement('span');
  main.className = 'irid-veil__flow';
  const alt = document.createElement('span');
  alt.className = 'irid-veil__flow is-alt';
  veil.append(main, alt);

  document.body.appendChild(veil);

  const half = veil.getBoundingClientRect().width / 2 || 38;

  // 初始停在视口外，避免进场时左上角闪一下
  const offscreen = -config.size.length * 2;
  let targetX = offscreen;
  let targetY = offscreen;
  let currentX = targetX;
  let currentY = targetY;
  let frame = 0;

  // ---- 显隐 / 抑制状态机 ------------------------------------
  // 「指针在页面上」与「遮罩未被抑制」是两个独立条件，
  // 最终可见性 = 两者同时成立。
  let pointerInside = false;
  let suppressed = false;

  const applyVisibility = () => {
    const visible = pointerInside && !suppressed;
    veil.classList.toggle('is-on', visible);
    veil.classList.toggle('is-suppressed', suppressed);
  };

  const paint = () => {
    // 阻尼跟随，比硬跟随更有液态的拖尾感
    currentX += (targetX - currentX) * config.damping;
    currentY += (targetY - currentY) * config.damping;
    veil.style.transform = `translate3d(${currentX - half}px, ${currentY - half}px, 0)`;
    frame = requestAnimationFrame(paint);
  };

  const onMove = (event: PointerEvent) => {
    targetX = event.clientX;
    targetY = event.clientY;
    pointerInside = true;
    applyVisibility();
    if (!frame) frame = requestAnimationFrame(paint);
  };

  const onLeave = () => {
    pointerInside = false;
    applyVisibility();
  };

  window.addEventListener('pointermove', onMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);

  return {
    setVisible(visible: boolean) {
      pointerInside = visible;
      applyVisibility();
    },
    setSuppressed(next: boolean) {
      suppressed = next;
      applyVisibility();
    },
    get suppressed() {
      return suppressed;
    },
    destroy() {
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      if (frame) cancelAnimationFrame(frame);
      veil.remove();
    },
  };
}

/** 触摸设备等不挂载场景下的空句柄，接口保持一致 */
function createNoopHandle(): IridescenceHandle {
  return {
    setVisible() {},
    setSuppressed() {},
    get suppressed() {
      return false;
    },
    destroy() {},
  };
}
