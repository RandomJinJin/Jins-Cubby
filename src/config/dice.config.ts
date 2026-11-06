export interface DicePage {
  /** 骰子面编号 1-N */
  face: number;
  /** 悬停 / 展开后显示在该面上的页面标题 */
  title: string;
  /** 目标地址，null 表示该面未分配页面（展开后为不可交互的灰色） */
  url: string | null;
}

export interface RollPage {
  title: string;
  url: string;
}

/**
 * 本站页面的地址：开发环境（pnpm dev）用本地相对路径，便于直接查看本地构建的页面；
 * 正式构建时使用配置的站点域名。
 */
const siteUrl = (path: string) =>
  import.meta.env.DEV ? path : `${import.meta.env.SITE.replace(/\/$/, '')}${path}`;

/**
 * 主页使用的正二十面骰子（20 个正三角形面）的页面映射。
 * 只改这里即可调整每个面进入哪个页面；url 设为 null 即视为未分配。
 * 面编号按正二十面体几何自动生成，相对面数字之和为 21。
 */
export const DICE_PAGES: DicePage[] = [
  { face: 1, title: '—', url: null },
  { face: 2, title: '—', url: null},
  { face: 3, title: 'ABOUT ME', url: siteUrl('/about') },
  { face: 4, title: '—', url: null },
  { face: 5, title: '—', url: null },
  { face: 6, title: '—', url: null },
  { face: 7, title: 'LAB', url: 'https://lab.randomjin.top/' },
  { face: 8, title: '—', url: null },
  { face: 9, title: 'BLOG', url: 'https://blog.randomjin.top/' },
  { face: 10, title: 'FRIENDS', url: siteUrl('/friends')  },
  { face: 11, title: '—', url: null },
  { face: 12, title: '—', url: null },
  { face: 13, title: 'TIMELINE', url: siteUrl('/timeline') },
  { face: 14, title: '—', url: null },
  { face: 15, title: '—', url: null },
  { face: 16, title: '—', url: null },
  { face: 17, title: 'DUDU', url: 'https://blog.randomjin.top/dudu' },
  { face: 18, title: '—', url: null },
  { face: 19, title: '—', url: null },
  { face: 20, title: '—', url: null },
];

/**
 * 正十二面骰子（12 个正五边形面）的页面映射，保持不变。
 * 若要换回十二面体：把 dice.ts 的 buildIcosahedron 改为 buildDodecahedron，
 * 并把下面这份数组接到 pageOfFace 上。
 */
export const DODECA_PAGES: DicePage[] = [
  { face: 1, title: 'BLOG', url: 'https://blog.randomjin.top/' },
  { face: 2, title: 'LAB', url: 'https://lab.randomjin.top/' },
  { face: 3, title: 'ABOUT ME', url: siteUrl('/about') },
  { face: 4, title: 'DUDU', url: 'https://blog.randomjin.top/dudu' },
  { face: 5, title: 'FRIENDS', url: siteUrl('/friends') },
  { face: 6, title: '—', url: null },
  { face: 7, title: '—', url: null },
  { face: 8, title: '—', url: null },
  { face: 9, title: '—', url: null },
  { face: 10, title: '—', url: null },
  { face: 11, title: '—', url: null },
  { face: 12, title: '—', url: null },
];

/**
 * 「随机投掷」的候选页面，与骰子的面无关。
 * 页面池由 scripts/generate-roll-pool.mjs 在构建前自动生成（src/config/rollPool.json）：
 * 汇聚主站全部页面、blog 的 sitemap 页面（含每篇文章）与 lab 的内容页，
 * 因此可以随机投掷到页面层级，无需手动维护列表。
 */
import rollPool from './rollPool.json';

export const ROLL_PAGES: RollPage[] = rollPool.map((entry) => ({
  title: entry.title,
  // 主站页面在池中存的是路径：dev 用本地路由，构建后拼站点域名
  url: 'path' in entry && entry.path ? siteUrl(entry.path) : entry.url,
}));

export const pageOfFace = (face: number): DicePage | undefined =>
  DICE_PAGES.find((page) => page.face === face);
