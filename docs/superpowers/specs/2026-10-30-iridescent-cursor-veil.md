# 炫彩鼠标遮罩（Iridescent Cursor Veil）

> 状态：**已实施并验证**（方案 A）
> 实施日期：2026-10-30
> 实现位置：`src/iridescence/`（独立可移植模块，详见该目录的 README）

## 目标
在保持站点黑白配色的前提下，叠加一层跟随鼠标的「液态金属」反光：

- 光标周围有一个直径 4cm 的圆形区域，圆形边缘向外淡出
- 圆形范围内，**底色本身是黑色**的像素被替换为流动的金属质感炫彩（白 → 紫 → 蓝 → 红 的液态金属色带）
- 白色与浅灰区域**逐像素零变化**，模型原有配色完全不变
- 覆盖全站：DOM 黑色控件（按钮、黑色文字）与 3D 骰子的黑色描边 / 黑色数字

## 核心原理

混合模式的选择是本方案最关键的一步。最初的设想用 `screen`，实测后发现它在近白底上做不到"只作用黑色"。

### screen 的问题
`screen` 的数学定义是 `结果 = 1 − (1−底色)(1−叠加色)`：

| 底色 | screen 结果 | 实测 Δ |
| --- | --- | --- |
| 黑 `#1a1a1a` | = 叠加色 | 黑色处显彩 ✅ |
| 白 `#ffffff` | 白 | Δ=0 ✅ |
| 浅灰 `#f5f5f5` | 底色 + 12/255 × 叠加色 | **Δ=7.6~11.8 ⚠️** |

`screen` 会把浅灰底**整体抬亮**约 11/255，页面上出现一个明显的白色圆斑。且抬亮量与叠加色亮度成正比 —— 无论怎么调色板峰值都消不掉。

### 最终采用 lighten
`lighten` 的定义是 `结果 = max(底色, 叠加色)`：

| 底色 | lighten 结果 | 实测 Δ |
| --- | --- | --- |
| 黑 `#1a1a1a` | 叠加色 | **Δ=185 ✅** 明显显彩 |
| 白 `#ffffff` | 白 | **Δ=0 ✅** |
| 浅灰 `#f5f5f5` | 浅灰 | **Δ=0 ✅** 零变化 |

关键约束：**调色板所有通道封顶在 242**（低于页面底色 `#f5f5f5` = 245）。这样叠加色永远比浅色底暗，`max` 取到底色本身，浅色区域就是**数学上的零变化**，而不是"肉眼勉强看不见"。

第二层叠加也遵守同一约束（半透明 0.6 混合后峰值仍 ≤ 242），两层交叉织出金属虹彩的干涉纹理。

## 实现：独立可移植模块 `src/iridescence/`

模块不依赖 Astro 或任何框架，只用原生 TypeScript 与 DOM API，复制整个目录即可移植到其他项目。

```
src/iridescence/
├── index.ts    入口：mountIridescence(options)
├── config.ts   ★ 默认配置 —— 颜色 / 形状 / 大小都在这里
├── types.ts    配置项类型
├── style.ts    配置 → CSS 编译器
└── README.md   移植说明
```

### 1. `src/iridescence/config.ts` —— 唯一的控制面板

```ts
export const DEFAULT_CONFIG: IridescenceConfig = {
  /* 形状与尺寸 */
  size: '4cm',            // 直径，任意 CSS 长度
  shape: 'circle',        // 'circle' | 'square' | 'rounded'
  radius: '0',            // 方形 / 圆角矩形的圆角
  feather: 0.32,          // 边缘淡出起点，0 为锐利

  /* 颜色 */
  palette: ['#eeeef2', '#9d5cf5', '#3f7df0', '#ff4d4d', '#f5f0f7'],
  paletteAlt: ['#eeeef2', '#ff4d4d', '#3f7df0', '#9d5cf5', '#f5f0f7'],
  stops: undefined,       // 各色在圆周上的位置，省略则均分
  phaseAlt: 180,

  /* 混合 */
  blendMode: 'lighten',
  maxChannel: 242,        // 通道封顶：浅色底零变化的保证

  /* 质感 */
  opacity: 1,
  altOpacity: 0.6,
  blur: 4,
  bleed: 0.25,

  /* 动效 */
  spinDuration: 9,
  spinDurationAlt: 13,
  damping: 0.25,

  /* 环境 */
  zIndex: 5,
  requireFinePointer: true,
  respectReducedMotion: true,
};
```

### 2. `src/iridescence/style.ts` —— 配置编译成 CSS

样式表是**静态**的（所有实例共用一份），随配置变化的部分全部走 CSS 自定义属性，由每个实例以内联样式写在自己的元素上。因此多实例可以并存、各自配置互不干扰，卸载后重挂也不会串配置。

```ts
export function clampColor(color: string, maxChannel: number | null): string {
  if (maxChannel === null) return color;
  const rgb = parseColor(color);
  if (!rgb) return color;
  const [r, g, b] = rgb.map((c) => Math.min(c, maxChannel));
  return `rgb(${r} ${g} ${b})`;
}
```

`clampColor` 是零变化的关键：把调色板每个通道压到 `maxChannel` 以下（默认 242，低于常见的浅色底 `#f5f5f5` = 245），`lighten` 取 max 时浅色底就是数学上的零变化。

### 3. `src/iridescence/index.ts` —— 挂载

```ts
export function mountIridescence(options?: IridescenceOptions): () => void {
  const config = { ...DEFAULT_CONFIG, ...options };
  if (config.requireFinePointer && !window.matchMedia(FINE_POINTER).matches) return () => {};

  injectStyles();

  const veil = document.createElement('div');
  veil.className = 'irid-veil';
  const vars = compileVars(config);
  for (const [key, value] of Object.entries(vars)) veil.style.setProperty(key, value);
  // ... 追加两层色带、绑定 pointermove、返回卸载函数
}
```

### 4. `src/layouts/BaseLayout.astro` —— 接入（仅主页）

遮罩只在主页启用，由页面的 `iridescence` 属性决定：

```astro
<!-- src/pages/index.astro -->
<BaseLayout title="今斤 · Index" iridescence>
```

```astro
<!-- src/layouts/BaseLayout.astro -->
<html lang="zh-CN" data-iridescence={iridescence ? 'on' : undefined}>

<script>
  import { mountIridescence } from '../iridescence';
  import { DIE_HOVER_EVENT } from '../config/events';

  // 仅在标记了 data-iridescence="on" 的页面挂载（当前仅主页）
  if (document.documentElement.dataset.iridescence === 'on') {
    const veil = mountIridescence();

    // 悬停的骰子面是纯黑，遮罩叠加上去会形成突兀的彩色圆斑。
    // 悬停期间让遮罩退场，恢复纯黑底白字。
    window.addEventListener(DIE_HOVER_EVENT, (event) => {
      const detail = (event as CustomEvent<{ active: boolean }>).detail;
      veil.setSuppressed(detail.active);
    });
  }
</script>
```

> `DIE_HOVER_EVENT` 常量放在 `src/config/events.ts` 而非 `scripts/dice.ts` —— 否则 about / friends 页 import 它时会连带加载整个 620KB 的 three.js chunk。剥离后这两个页只加载 4.8KB 的布局脚本。

### 5. 必须的一行准备 — `src/styles/global.css`

```css
html {
  background: var(--bg);   /* 原有 body 背景会传播到 canvas，
                               canvas 背景不参与混合组，遮罩会失去 backdrop */
}
```


## 为什么骰子也会被覆盖

`.canvas-host` 是 `position: fixed; inset: 0` 且 `z-index: auto`，属于根 stacking context 的成员，因此 canvas 的像素参与遮罩的混合：

- 骰子白色面 → `max(白, ≤242)` = 白 → 配色不变 ✅
- 黑色描边（`LineBasicMaterial` `0x1a1a1a`）→ 变为炫彩 ✅
- 黑色数字（`numberTexture` 的 `#1a1a1a` 深色贴图）→ 变为炫彩 ✅

**`src/scripts/dice.ts` 的视觉逻辑零改动** —— 仅新增一行悬停事件广播（见下方「hover 冲突处理」）。

### hover 冲突处理

悬停时骰子面会被反色成纯黑（黑底白字），而 `lighten` 的触发条件恰好是「底色比叠加色暗」，于是 hover 恰恰是遮罩最容易爆发的地方：光标下会出现一个突兀的彩色圆斑。

处理方式：悬停期间让遮罩完全退场。

**为什么可以整体退场而不是局部挖洞** —— 遮罩唯一能生效的像素就是悬停面本身。其他区域要么是白色骰面（`max(255, ≤242)` = 255，逐像素不变），要么是浅灰背景（`max(245, ≤242)` = 245，零变化），本就零贡献。因此「整体退场」在视觉上完全等价于「在 hover 区域让位」，却省掉了 3D 顶点投影与每帧同步。

实测：抑制态截图与 `display:none` 截图 SHA 完全一致 —— 遮罩对画面零贡献，不是「变淡了」。

详见 `docs/superpowers/specs/2026-10-30-dice-hover-iridescence-conflict.md`。

## 实测结果（headless Chrome + CDP 像素级测量）

测量方法：光标固定在同一点，只切换遮罩显隐，两次截图紧邻 —— 排除骰子自转与悬停态变化的干扰。

| 底色 | 之前 | 之后 | Δ |
| --- | --- | --- | --- |
| 黑 `#1a1a1a` | rgb(26,26,26) | rgb(196,143,194) | **185** |
| 白 `#ffffff` | rgb(255,255,255) | rgb(255,255,255) | **0** |
| 浅灰 `#f5f5f5` | rgb(245,245,245) | rgb(245,245,245) | **0** |
| 骰子描边 | rgb(29,29,29) | rgb(196,143,194) | 局部最大 199 |
| 页面文字 | 纯黑 | 逐字紫→蓝→粉渐变 | — |

视觉确认（放大裁切）：
- 黑色方块上是一颗紫蓝红交织的液态金属球，边缘柔和淡出回纯黑，方块之外零溢出
- 骰子描边从纯黑渐变为粉紫→蓝→紫，白色骰面保持纯白
- about 页（可滚动）同样正常，遮罩圆内的文字逐字染上渐变，圆外保持纯黑

## 可调参数

全部参数集中在 `src/iridescence/config.ts`，完整列表见 `src/iridescence/types.ts` 与该目录的 README。

| 参数 | 默认 | 说明 |
| --- | --- | --- |
| `size` | `'4cm'` | 直径，任意 CSS 长度 |
| `shape` | `'circle'` | `'circle'` \| `'square'` \| `'rounded'` |
| `radius` | `'0'` | 方形 / 圆角矩形的圆角 |
| `feather` | `0.32` | 边缘淡出起点，0 为锐利 |
| `palette` | 白紫蓝红白 | 主色带，沿圆周循环 |
| `paletteAlt` | 由 palette 派生 | 第二层色带 |
| `stops` | 均分 | 各色在圆周上的位置（0~1） |
| `phaseAlt` | `180` | 第二层相位偏移（度） |
| `blendMode` | `'lighten'` | 混合模式 |
| `maxChannel` | `242` | 颜色通道封顶 |
| `opacity` | `1` | 整体不透明度 |
| `altOpacity` | `0.6` | 第二层不透明度 |
| `blur` | `4` | 色带模糊半径（px） |
| `bleed` | `0.25` | 色带溢出比例 |
| `spinDuration` | `9` | 主层旋转一周秒数 |
| `spinDurationAlt` | `13` | 第二层旋转一周秒数 |
| `damping` | `0.25` | 跟随阻尼，越小拖尾越长 |
| `zIndex` | `5` | 遮罩层级 |
| `requireFinePointer` | `true` | 触摸设备不挂载 |
| `respectReducedMotion` | `true` | 尊重系统的「减少动态效果」 |

改配置有三种方式：直接改 `config.ts` 的默认值（全局生效）、调用时传参（`mountIridescence({ palette: [...] })`）、或两者结合。

## 边界与坑位

1. **调色板峰值不得超过 242**（页面底色 `#f5f5f5` = 245）。这是 `lighten` 零变化的前提；一旦超过，浅灰底会被抬亮出现白斑（实测 `screen` 模式 Δ=7.6、`lighten` 峰值 255 时同样会亮）。`maxChannel` 会自动压缩调色板，但自定义 `blendMode: 'screen'` 时需自行留意。
2. **`html` 必须有背景色**，否则 body 背景传播到 canvas，canvas 背景不参与混合组，遮罩会退化成盖在页面上的实色圆斑。
3. **`.stage` 的 `opacity`**：`opacity < 1` 会创建 stacking context，canvas 便脱离根混合组 → 骰子不受遮罩影响。当前 `global.css` 里 `.stage` 初始 `opacity: 0`、`.stage.is-ready` 恢复 `1`，因此效果在 0.8s 淡入结束后生效。若之后给 `.stage` 或 `.canvas-host` 加 `transform` / `filter` / `will-change`，骰子会再次掉出混合组。
4. **触摸设备**：`(hover: hover) and (pointer: fine)` 之外不挂载，避免移动端无意义的合成开销。
5. **动效偏好**：`prefers-reduced-motion: reduce` 时停掉旋转动画，保留静态色带。
6. **DPR**：CSS 层用 `4cm` 天然正确。

## 涉及文件

| 文件 | 动作 |
| --- | --- |
| `src/iridescence/index.ts` | 新增 —— 入口与挂载逻辑，返回 `IridescenceHandle` |
| `src/iridescence/config.ts` | 新增 —— 默认配置（控制面板） |
| `src/iridescence/types.ts` | 新增 —— 配置项类型 + `IridescenceHandle` |
| `src/iridescence/style.ts` | 新增 —— 配置 → CSS 编译器 |
| `src/iridescence/README.md` | 新增 —— 移植说明 |
| `src/config/events.ts` | 新增 —— `DIE_HOVER_EVENT` 常量（独立文件，避免牵连 three.js） |
| `src/layouts/BaseLayout.astro` | 引入模块；按 `iridescence` 属性决定是否挂载 |
| `src/pages/index.astro` | 传 `iridescence` 开启遮罩（仅主页） |
| `src/styles/global.css` | 移除遮罩样式（改由模块注入）；`html` 补背景色 |
| `src/scripts/dice.ts` | 仅新增一行悬停事件广播，视觉逻辑零改动 |

## 验收标准

1. ✅ 鼠标停在页面任意位置：光标周围出现圆形炫彩区域，边缘柔和淡出
2. ✅ 圆形扫过黑色按钮 / 黑色文字：这些像素变成流动的白紫蓝红金属色
3. ✅ 圆形扫过骰子：黑色描边与深色数字变彩，白色面片颜色完全不变
4. ✅ 浅灰背景与纯白骰面逐像素零变化
5. ✅ 圆形离开后：无残留、无痕
6. ✅ 窗口缩放、页面滚动后遮罩仍跟随光标，尺寸不变
7. ✅ 改 `config.ts` 的 `palette` / `size` / `shape` 后效果随之改变
8. ✅ 多实例并存时各自配置互不干扰，仅共用一份样式表
9. ✅ **仅主页有遮罩**：about / friends 页 `document.querySelectorAll('.irid-veil').length === 0`
10. ✅ **悬停骰子面时遮罩退场**：悬停面纯黑、白字清晰、零彩色圆斑；移开鼠标后遮罩恢复
11. ✅ 抑制态对画面零贡献（抑制态截图与 `display:none` 截图 SHA 完全一致）
12. ✅ about / friends 页不加载 three.js chunk（产物实测 4.8KB vs 620KB）

