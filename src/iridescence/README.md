# iridescence · 炫彩鼠标遮罩

一个跟随光标的液态金属色遮罩。它用 `mix-blend-mode` 混合，**只染原本偏暗的像素**——白色区域、浅灰背景、3D 模型的原有配色都逐像素零变化。

本目录是自包含的：不依赖 Astro、React 或任何框架，只用原生 TypeScript 与 DOM API。

## 文件结构

```
src/iridescence/
├── index.ts    入口：mountIridescence(options)
├── config.ts   ★ 默认配置 —— 改这里
├── types.ts    配置项类型
└── style.ts    配置 → CSS 的编译器
```

## 快速上手

```ts
import { mountIridescence } from './iridescence';

mountIridescence();
```

带配置：

```ts
mountIridescence({
  palette: ['#f0f', '#08f', '#f00'],
  size: '3cm',
  shape: 'rounded',
  radius: '12px',
});
```

返回运行时句柄：

```ts
const veil = mountIridescence();

veil.setVisible(false);   // 隐藏（带过渡）
veil.setSuppressed(true); // 抑制：完全淡出，用于在特定区域主动让位
veil.suppressed;          // 读取当前抑制状态
veil.destroy();           // 卸载并清理所有监听
```

### 让遮罩在某个区域主动让位

典型场景：页面上有个交互元素本身是深色的，遮罩叠上去会形成一个突兀的圆斑。
这时用 `setSuppressed(true)` 让遮罩退场，交互元素保持原本的样子。

```ts
const veil = mountIridescence();

element.addEventListener('pointerenter', () => veil.setSuppressed(true));
element.addEventListener('pointerleave', () => veil.setSuppressed(false));
```

遮罩会完全淡出（`opacity: 0`），对画面零贡献 —— 实测抑制态与 `display: none` 的截图哈希完全相同。

## 配置项

全部字段见 `types.ts`，这里列出常用的：

| 字段 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `palette` | `string[]` | 白紫蓝红白 | 主色带，沿圆周循环 |
| `paletteAlt` | `string[]` | 由 palette 派生 | 第二层色带，用于交叉出干涉纹理 |
| `stops` | `number[]` | 均分 | 各色在圆周上的位置（0~1） |
| `size` | `string` | `'4cm'` | 遮罩直径，任意 CSS 长度 |
| `shape` | `'circle' \| 'square' \| 'rounded'` | `'circle'` | 外形 |
| `radius` | `string` | `'0'` | 方形 / 圆角矩形的圆角 |
| `feather` | `number` | `0.32` | 边缘淡出起点，0 为锐利边缘 |
| `blendMode` | `'lighten' \| 'screen' \| ...` | `'lighten'` | 混合模式 |
| `maxChannel` | `number \| null` | `242` | 颜色通道封顶值 |
| `opacity` | `number` | `1` | 整体不透明度 |
| `blur` | `number` | `8` | 色带模糊半径（px） |
| `bleed` | `number` | `0.5` | 色带溢出比例 |
| `spinDuration` | `number` | `9` | 主层旋转一周秒数 |
| `spinDurationAlt` | `number` | `13` | 第二层旋转一周秒数 |
| `damping` | `number` | `0.25` | 跟随阻尼，越小拖尾越长 |
| `zIndex` | `number` | `5` | 遮罩层级 |
| `requireFinePointer` | `boolean` | `true` | 触摸设备不挂载 |
| `respectReducedMotion` | `boolean` | `true` | 尊重系统的「减少动态效果」 |

## 移植到其他项目

1. 复制整个 `src/iridescence/` 目录。
2. 在入口处调用 `mountIridescence()`。

```ts
// React
import { useEffect } from 'react';
import { mountIridescence } from './iridescence';

export function Iridescence() {
  useEffect(() => mountIridescence(), []);
  return null;
}
```

```html
<!-- 原生 HTML -->
<script type="module">
  import { mountIridescence } from './iridescence/index.js';
  mountIridescence();
</script>
```

3. **必须给 `<html>` 加背景色**。若根元素没有背景，body 的背景会传播到 canvas，而 canvas 背景不参与混合组，遮罩会退化成盖在页面上的实色圆斑。

```css
html {
  background: #f5f5f5;
}
```

## 两个关键机制

### 1. 为什么用 `lighten` 而不是 `screen`

`screen` 的结果是 `1 − (1−底色)(1−叠加色)`，会把浅灰底整体抬亮约 11/255，页面上出现明显的白色圆斑，且抬亮量与叠加色亮度成正比，调色板峰值消不掉。

`lighten` 的结果是 `max(底色, 叠加色)`。只要叠加色比页面背景暗，浅色区域就是**数学上的零变化**。

### 2. `maxChannel` 是零变化的保证

`lighten` 取两者较大值，所以叠加色一旦比底色亮就会顶起底色。把调色板的每个通道压到 `maxChannel` 以下（默认 242，低于常见的浅色底 `#f5f5f5` = 245），浅色底就是逐像素零变化，而黑色处仍完全显彩。

实测（headless Chrome 像素级测量）：

| 底色 | 之前 | 之后 | Δ |
| --- | --- | --- | --- |
| 黑 `#1a1a1a` | rgb(26,26,26) | rgb(196,143,194) | 185 |
| 白 `#ffffff` | rgb(255,255,255) | rgb(255,255,255) | **0** |
| 浅灰 `#f5f5f5` | rgb(245,245,245) | rgb(245,245,245) | **0** |

## 已知边界

- 遮罩是 `position: fixed` 的全屏元素。若目标元素所在的祖先有 `opacity < 1`、`filter`、`transform` 或 `will-change`，会创建新的层叠上下文，被遮罩的元素可能脱离混合组而不受影响。
- `mix-blend-mode` 混合发生在同一层叠上下文内。若页面某部分用 `isolation: isolate` 隔离，遮罩对该部分无效。
- 遮罩只覆盖视口内的元素，无法作用于视口外的内容。
