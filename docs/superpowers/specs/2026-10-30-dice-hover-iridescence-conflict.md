# 骰子 hover 与炫彩遮罩的冲突处理

> 状态：**第 1 步已实施并验证**（遮罩在 hover 时退场）
> 第 2 步（hover 面变液态金属）待定
> 日期：2026-10-30

## 冲突根因

这不是视觉上的"不搭"，而是两套机制在同一批像素上正面相撞。

当前 hover 的实现（`src/scripts/dice.ts`）：

```ts
// dice.ts —— 悬停时把面推到纯黑
gsap.to(hovered.mesh.material.color, { r: 0, g: 0, b: 0, duration: 0.18, overwrite: true });
// 同时把数字换成浅色贴图
hovered.numberMesh.material.map = mode === 'net' ? hovered.darkMap : hovered.lightMap;
```

遮罩的混合模式是 `lighten`，结果为 `max(底色, 叠加色)`：

| 像素 | 底色 | lighten 结果 |
| --- | --- | --- |
| 未悬停的面 | 白 `#ffffff` | 255 → **完全不变** ✅ |
| **悬停的面** | **纯黑 `#000000`** | max(0, 炫彩) = **炫彩全覆盖** ⚠️ |
| tooltip 气泡 | 黑 `#1a1a1a` | 同上，被染色 ⚠️ |
| 骰子描边 | 黑 `#1a1a1a` | 同上 ✅（这是想要的） |

关键点：hover 状态**故意**把面推到最暗值 0，而 `lighten` 的触发条件恰好是"底色比叠加色暗"。于是 hover 恰恰成了遮罩最容易爆发的地方——光标周围本该是纯粹的黑面，现在变成"黑面上贴了一个发光圆斑"。

圆斑的出现位置也固定在光标处，而光标正落在悬停面上，视觉上就是"面中央一个亮斑"，最突兀。

---

## 第 1 步（已实施）：hover 时遮罩整体退场

### 关键洞察：不需要做 3D 投影挖洞

原设想是把悬停面的三角形投影到屏幕坐标，用 `clip-path` 在遮罩上挖洞。但这���必要 ——

**遮罩唯一能生效的像素就是悬停面本身。** 页面上的其他区域要么是白色骰面（`max(255, 炫彩)` = 255，逐像素不变），要么是浅灰背景（`max(245, ≤242)` = 245，零变化）。遮罩圆覆盖到的所有非悬停区域，本就零贡献。

于是「hover 时让遮罩整体隐藏」在视觉上**完全等价于**「在 hover 区域遮罩不显示」，但实现复杂度天差地别：

| | 投影挖洞 | 整体退场（采用） |
| --- | --- | --- |
| 需要 3D 顶点投影 | 是 | 否 |
| 需要每帧同步 WebGL 与 DOM | 是 | 否 |
| 硬边贴在黑面上，反而生硬 | 是 | 否（整体淡出） |
| 代码量 | 大 | 极小 |

### 实现

**1. 遮罩模块增加抑制状态**（`src/iridescence/`）

`mountIridescence` 的返回值从「卸载函数」改为**运行时句柄** `IridescenceHandle`：

```ts
interface IridescenceHandle {
  setVisible(visible: boolean): void;
  setSuppressed(suppressed: boolean): void;
  readonly suppressed: boolean;
  destroy(): void;
}
```

内部把「指针在页面上」与「未被抑制」拆成两个独立状态，最终可见性 = 两者同时成立：

```ts
let pointerInside = false;
let suppressed = false;

const applyVisibility = () => {
  const visible = pointerInside && !suppressed;
  veil.classList.toggle('is-on', visible);
  veil.classList.toggle('is-suppressed', suppressed);
};
```

分离这两个状态是必要的：`pointerleave` 会把 `pointerInside` 置 false，但如果不分离，遮罩退场时会把「抑制」状态一起清掉，鼠标移回页面又会立刻显彩。

**2. CSS 增加抑制态**（`src/iridescence/style.ts`）

```css
.irid-veil.is-suppressed {
  opacity: 0;
}
```

**3. dice.ts 广播悬停事件**（`src/scripts/dice.ts`）

```ts
window.dispatchEvent(
  new CustomEvent(DIE_HOVER_EVENT, { detail: { active: hovered !== null } }),
);
```

事件常量放在独立的 `src/config/events.ts`，**不放�� `dice.ts` 里** —— 否则任何 import 它的页面都会连带加载整个 620KB 的 three.js chunk。

**4. 布局接线**（`src/layouts/BaseLayout.astro`）

```ts
window.addEventListener(DIE_HOVER_EVENT, (event) => {
  const detail = (event as CustomEvent<{ active: boolean }>).detail;
  veil.setSuppressed(detail.active);
});
```

### 实测结果

headless Chrome + CDP：

| 场景 | 结果 |
| --- | --- |
| 悬停前遮罩 opacity | 1 |
| 悬停后遮罩 opacity | **0** |
| `is-suppressed` | true |
| 移开鼠标 | 恢复 opacity 1 |
| **抑制态截图 vs `display:none` 截图** | **SHA 完全一致** ✅ |

最后一项是决定性证据：遮罩在抑制态下对画面**零贡献**，不是"变淡了"，是真的完全不参与合成。

视觉确认（2 倍放大）：悬停面纯黑、白色数字清晰、零彩色圆斑；相邻白色骰面与浅灰背景同样零变化。

---

## 方案一：保留 hover，遮罩在 hover 区域让位

hover 语义完全不动（黑面 + 白数字），遮罩在悬停面上不显示。

### 实现思路

遮罩是屏幕空间的固定元素（`position: fixed`），而悬停面是 3D 空间里的一块三角形。两者不在同一坐标系，需要建立映射。

**思路 A：屏幕空间遮罩 + 反向遮罩（clip-path）**

悬停发生时，用悬停面的三个顶点投影到屏幕坐标，生成一个三角形 clip-path，让遮罩在该区域被"挖空"。

- 骰子每个面已经能拿到世界坐标（`view.mesh.getWorldPosition` + `project(camera)`，见 `dice.ts:430` 的 `updateLabels`），面中心投影是现成的
- 需要的是三角形三个顶点：`face.localVertices` 已有（`src/lib/icosa.ts`），投影后得到屏幕多边形
- 遮罩加 `clip-path: polygon(...)`，或用 `mask` 组合两个图层

难点：多边形的 clip-path 会随骰子转动而每帧变化，需要在渲染循环里同步更新；且遮罩是 DOM 元素、骰子是 WebGL canvas，两者更新时机要同步。

**思路 B：让 three.js 侧主动"让位"**

反过来做——不在 DOM 侧挖洞，而是让 hover 时把该区域的遮罩效果压掉。问题是遮罩是 CSS 混合，three.js 无从介入。

**思路 C（最简，已采用）**

hover 时直接让遮罩淡出。

原方案的顾虑是"整个页面的遮罩都消失，失去连续性"。但这个顾虑**不成立** —— 因为遮罩在悬停面之外的所有区域本就零贡献（白色骰面 255 不变、浅灰底 245 不变），"消失"的只是那个本就不产生任何视觉变化的部分。

实际实现（比 class 切换更干净，因为需要与"指针是否在页面上"两个状态解耦）：

```ts
// src/iridescence/index.ts
const applyVisibility = () => {
  const visible = pointerInside && !suppressed;
  veil.classList.toggle('is-on', visible);
  veil.classList.toggle('is-suppressed', suppressed);
};
```

### 评价

| | |
| --- | --- |
| 优点 | hover 语义零改动，风险最低；黑白反色的设计语言完整保留；无需 3D 投影，零同步耦合 |
| 缺点 | 严格来说是「整个遮罩退场」而非「局部挖洞」，但因非悬停区域本就零变化，视觉上无差别 |
| 风险 | 低。实测抑制态与 `display:none` 截图哈希完全一致 |

---

## 方案二：hover 面直接变液态金属（推荐）

把"反色成黑"改成"变成液态金属"，让 hover 与遮罩用同一套视觉语言，不再打架。

### 设计要点

悬停面不再是纯黑，而是**流动的金属质感**：白紫蓝红色带在面上流动，带菲涅尔边缘光，随视角变化。

这个效果必须做在 three.js 内部（不能靠 DOM 遮罩），原因有三：

1. **贴合表面**：色带随面的空间位置变化，骰子转动时金属跟着走
2. **真实反光**：需要法线参与，DOM 遮罩拿不到法线
3. **不被遮罩二次叠加**：面本身已是彩色，`lighten` 再叠一层会脏

### 实现路径

在 `MeshStandardMaterial` 的片元着色器里注入（已核验 r186 注入点）：

- `MeshStandardMaterial` → `physical` 着色器
- 片元尾部结构：`opaque_fragment → tonemapping_fragment → colorspace_fragment → fog_fragment`
- 在 `colorspace_fragment` **之前**注入，此时 `outgoingLight` 已算出、且处于线性空间
- `vViewPosition` 在 `meshphysical` 中无条件可用（`meshphysical.glsl.js:134`）→ 可算菲涅尔
- 顶点着色器含 `begin_vertex` 与 `worldpos_vertex` → 可传世界坐标做流动

注入逻辑（概念）：

```glsl
// 顶点：传世界坐标与法线
vIridPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;

// 片元
float fres = pow( 1.0 - abs( dot( normalize( vNormal ), normalize( vViewPosition ) ) ), 2.0 );
float flow = iridFlow( vIridPos, uTime );              // 空间流动的色带
vec3 metal = iridPalette( flow ) * ( 0.35 + 0.65 * fres );
outgoingLight = mix( outgoingLight, metal, uHoverMix ); // uHoverMix 由 hover 动画驱动
```

配色沿用现有遮罩的调色板（白 `#eeeef2` → 紫 `#9d5cf5` → 蓝 `#3f7df0` → 红 `#ff4d4d`），保证两处观感统一。

### 关键：与遮罩的分工

| 区域 | 表现 | 实现 |
| --- | --- | --- |
| 悬停面 | 液态金属 | three.js 着色器 |
| 面的数字 | 深色 `#1a1a1a` | 反色逻辑改为「金属底 + 深色数字」 |
| 面的描边 | 保持黑 | 不变 |
| 面上其他位置（光标不在此处时） | 白 | 不变 |
| 页面其他黑色元素 | 液态金属 | 现有 DOM 遮罩 |
| tooltip | 液态金属底 + 深色字 | DOM 遮罩自然覆盖（它是黑底，会被染色）——但需确认文字可读性 |

**数字与 tooltip 的可读性是必须验证的点**：数字从白转深色，是因为金属底有明暗变化，白字在亮处会糊。tooltip 的白字同理，可能需要改成半透明黑底或加描边。

### 与现有反色逻辑的衔接

`dice.ts:374-386` 的 `setHover` 需要改：

```ts
// 旧：推到纯黑 + 换浅色数字贴图
gsap.to(hovered.mesh.material.color, { r: 0, g: 0, b: 0, ... });
hovered.numberMesh.material.map = mode === 'net' ? hovered.darkMap : hovered.lightMap;

// 新：推到深色 + 数字保持深色贴图（金属底上用深色数字）
gsap.to(hovered.mesh.material.color, { r: 0.08, g: 0.08, b: 0.08, ... });
// numberMesh 的 map 不再切换
```

同时 `uHoverMix` 需要跟着 hover 动画在 0↔1 之间过渡（用 gsap 驱动一个 uniform 对象）。

### 评价

| | |
| --- | --- |
| 优点 | hover 与遮罩统一语言，不再冲突；金属贴合 3D 表面，随转动变化，有真实反光；保留遮罩的核心观感 |
| 缺点 | 需要写 GLSL 注入，工作量最大；数字/文字的可读性要额外处理；金属底与黑色描边的对比关系要重新调 |
| 风险 | 中高。着色器注入有明确的落点（已核验），但需要实机反复调参 |

---

## 第三条路（备选）：hover 时遮罩让位，但保留描边发光

如果既不想写 GLSL，又不想让整个遮罩消失，可以做**局部让位**：

- 悬停时，不是遮罩消失，而是**遮罩的圆环被"吸"进悬停面**——即遮罩中心跟随悬停面的中心而非光标
- 悬停面上不出现圆斑（因为遮罩圆心移到面上中心，且配合黑色描边，视觉上被面的边界吸收）

这个方案实现成本介于两者之间，但观感偏"遮罩被面吸引"，与液态金属的联想不够直接。

---

## 选型建议

| | 方案一（挖洞） | 方案二（液态金属面） |
| --- | --- | --- |
| 实现量 | 中（投影同步） | 高（GLSL 注入 + 调参） |
| 观感 | 保留原 hover，黑白利落 | 统一语言，最有质感 |
| 与遮罩的一致性 | 割裂（一边金属一边纯黑） | 统一 |
| 风险 | 中 | 中高 |

**推荐方案二。** 理由：

1. 冲突的根因是"两套视觉语言争夺同一批像素"，方案一是在症状上打补丁（把遮罩藏起来），方案二是消除冲突本身
2. 方案二让"液态金属"这个概念贯穿全站——悬停面是金属、页面黑控件是金属，光标扫过处处生辉
3. 既然遮罩已经做好了可移植的模块，再往前一步做 3D 侧的金属面，是同一条思路的自然延伸

**但有个前提**：方案二需要额外工作来保证数字与 tooltip 的可读性。如果实测发现金属底的明暗变化让深色数字难以辨认，需要退回到"金属 + 白色数字 + 深色描边"的组合。

---

## 建议的分步实施

**第 1 步 · 解除冲突（不改观感）** ✅ **已实施**
hover 期间遮罩完全退场，恢复纯黑底白字。已实测验证，见上文「第 1 步」章节。

**第 2 步 · 液态金属面**（待定）
上 GLSL 注入，把 hover 面从「纯黑」改成「液态金属」，让悬停与遮罩用同一套视觉语言。

第 2 步有个前置问题要先解决：**DOM 遮罩与 three.js 的渲染顺序**。遮罩是 `position: fixed; z-index: 5` 的 DOM 元素，在 canvas 之上；它对 canvas 像素的混合发生在浏览器合成阶段。

不过第 1 步已经把这个前置问题解决了 —— hover 期间遮罩本来就是完全退场的（`opacity: 0`，对画面零贡献）。所以第 2 步做金属面时，**不需要额外处理二次叠加**，第 1 步的抑制机制可以直接沿用。

第 2 步唯一需要额外处理的是数字可读性：金属底有明暗变化，深色数字在亮处会糊，需要设计「金属 + 深色数字 + 深色描边」的组合。

---

## 涉及文件

| 文件 | 第 1 步（已实施） | 第 2 步（待定） |
| --- | --- | --- |
| `src/config/events.ts` | **新增** —— `DIE_HOVER_EVENT` 常量 | — |
| `src/scripts/dice.ts` | `setHover` 广播悬停事件 | `setHover` 改配色 + GLSL 注入 + uniform 驱动 |
| `src/iridescence/index.ts` | 返回值改为 `IridescenceHandle`，新增 `setSuppressed` | 沿用 |
| `src/iridescence/types.ts` | 新增 `IridescenceHandle` 类型 | 沿用 |
| `src/iridescence/style.ts` | 新增 `.is-suppressed` 样式 | 沿用 |
| `src/layouts/BaseLayout.astro` | 接线悬停事件 → `setSuppressed` | 沿用 |

> 注：`DIE_HOVER_EVENT` 放在 `src/config/events.ts` 而非 `dice.ts`，是为了避免任何 import 它的页面连带加载 620KB 的 three.js chunk。实测剥离后 about / friends 页只加载 4.8KB 的布局脚本。

## 已核验的技术前提

- `MeshStandardMaterial` → `physical` 着色器；`MeshBasicMaterial` / `LineBasicMaterial` → `basic` 着色器
- `physical` 片元尾部：`opaque_fragment → tonemapping_fragment → colorspace_fragment → fog_fragment`，在 `colorspace_fragment` 前注入即得线性空间的 `outgoingLight`
- `vViewPosition` 在 `physical` 中无条件可用（`meshphysical.glsl.js:134`）→ 菲涅尔可算
- 顶点着色器含 `begin_vertex`（`meshphysical.glsl.js:40`）→ 可传 `transformed`；`modelMatrix` 是内建 uniform
- `colorspace_pars_fragment` 提供 `sRGBTransferEOTF` / `sRGBTransferOETF` → 调色板可在正确色彩空间里生成
- `normal_fragment_begin` 在 `flatShading: true` 下用 `normalize(cross(fdx, fdy))` 推导法线（`normal_fragment_begin.glsl.js:8`）→ 面法线可用
- `face.localVertices` 已存在于 `src/lib/icosa.ts` → 投影得到屏幕三角形可行（若将来需要局部挖洞）

