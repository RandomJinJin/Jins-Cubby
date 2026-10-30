/**
 * 炫彩遮罩的配置类型。
 *
 * 该模块不依赖任何框架或构建工具，可直接复制到其他项目使用。
 */

/** 遮罩的混合模式。决定「哪些像素会被染色」。 */
export type IridescenceBlendMode =
  /** max(底色, 叠加色)：叠加色比底色暗时完全不动。配合 maxChannel 封顶可做到浅色底零变化（推荐） */
  | 'lighten'
  /** 1 − (1−底色)(1−叠加色)：叠加色越亮越明显，浅色底会被略微抬亮 */
  | 'screen'
  /** 叠加色直接覆盖底色 */
  | 'normal'
  /** 2×底色×叠加色，底色暗时效果明显 */
  | 'multiply';

/** 遮罩的外形 */
export type IridescenceShape =
  /** 正圆，边��径向淡出 */
  | 'circle'
  /** 方形，边框按 radius 圆角 */
  | 'square'
  /** 圆角矩形，径向淡出 */
  | 'rounded';

export interface IridescenceConfig {
  /**
   * 遮罩直径，任意 CSS 长度。
   * @example '2cm' | '76px' | '5rem'
   */
  size: string;

  /** 遮罩外形 */
  shape: IridescenceShape;

  /** shape 为 square / rounded 时的圆角 */
  radius: string;

  /**
   * 边缘淡出起点，0~1。
   * 0 表示边缘锐利无淡出；0.32 表示中心 32% 区域保持实心、向外渐隐。
   */
  feather: number;

  /**
   * 主色带。沿圆周循环排列，至少 1 个颜色。
   * 建议使用与页面背景对比足够强的饱和色。
   */
  palette: string[];

  /**
   * 第二层色带，用于与主层交叉织出金属虹彩的干涉纹理。
   * 省略时自动取 palette 的相位偏移版本。
   */
  paletteAlt?: string[];

  /**
   * 各颜色在圆周上的位置，0~1 的递增数组，长度需与 palette 对应。
   * 省略时按颜色数量均分。
   */
  stops?: number[];

  /** 第二层的起始相位（度）。默认 180（与主层反向对冲） */
  phaseAlt: number;

  /** 混合模式 */
  blendMode: IridescenceBlendMode;

  /**
   * 颜色通道封顶值（0~255），null 表示不封顶。
   *
   * 这是「只作用黑色」的关键：lighten 的结果是 max(底色, 叠加色)，
   * 只要叠加色比页面背景暗，浅色区域就是逐像素零变化。
   * 默认 242，低于浅色页面常见的 #f5f5f5(245)。
   */
  maxChannel: number | null;

  /** 遮罩整体不透明度 0~1 */
  opacity: number;

  /** 第二层不透明度 0~1 */
  altOpacity: number;

  /** 色带模糊半径（px），越大越像液态金属 */
  blur: number;

  /** 色带溢出容器的比例（0~1），越大色彩扫过的范围越广 */
  bleed: number;

  /** 主层旋转一周的秒数 */
  spinDuration: number;

  /** 第二层旋转一周的秒数 */
  spinDurationAlt: number;

  /** 跟随阻尼 0~1，越小拖尾越长 */
  damping: number;

  /** 遮罩层级 */
  zIndex: number;

  /** 仅在有精确指针的设备上启用（触摸设备不挂载） */
  requireFinePointer: boolean;

  /** 尊重系统的「减少动态效果」偏好 */
  respectReducedMotion: boolean;
}

/** 用户只需提供部分字段，其余走默认值 */
export type IridescenceOptions = Partial<IridescenceConfig>;

/**
 * 遮罩实例的运行时句柄。
 *
 * 由 mountIridescence() 返回，用于在运行期控制遮罩的显隐，
 * 而不必卸载重建（例如让遮罩在某些区域主动让位）。
 */
export interface IridescenceHandle {
  /** 显示 / 隐藏遮罩（带过渡） */
  setVisible(visible: boolean): void;
  /**
   * 抑制遮罩：被抑制时遮罩完全淡出，
   * 用于让遮罩在特定交互区域（例如黑色悬停面）主动退场。
   */
  setSuppressed(suppressed: boolean): void;
  /** 当前是否处于抑制状态 */
  readonly suppressed: boolean;
  /** 卸载遮罩并清理所有监听 */
  destroy(): void;
}
