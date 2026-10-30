/**
 * 跨模块的事件名常量。
 *
 * 单独成文件是为了避免打包器把重依赖（如 three.js）牵连进来：
 * 若常量定义在 scripts/dice.ts 里，任何 import 它的页面都会
 * 连带加载整个 3D 场景代码。
 */

/**
 * 骰子悬停状态变化事件。
 *
 * 悬停时面会被反色成纯黑（黑底白字），此时任何叠加在上方的
 * 炫彩遮罩都会在黑面上形成一个突兀的彩色圆斑。
 * 由 dice.ts 广播，外部据此决定如何响应。
 *
 * detail: { active: boolean } —— true 表示当前有面被悬停
 */
export const DIE_HOVER_EVENT = 'dice:hover';
