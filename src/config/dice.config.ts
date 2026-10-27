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
 * 主页使用的正二十面骰子（20 个正三角形面）的页面映射。
 * 只改这里即可调整每个面进入哪个页面；url 设为 null 即视为未分配。
 * 面编号按正二十面体几何自动生成，相对面数字之和为 21。
 */
export const DICE_PAGES: DicePage[] = [
  { face: 1, title: 'BLOG', url: 'https://randomjin.top/blog' },
  { face: 2, title: 'LAB', url: 'https://randomjin.top/lab' },
  { face: 3, title: 'DUDU', url: 'https://randomjin.top/dudu' },
  { face: 4, title: 'FRIENDS', url: 'https://randomjin.top/friends' },
  { face: 5, title: 'ABOUT ME', url: 'https://randomjin.top/aboutme' },
  { face: 6, title: '—', url: null },
  { face: 7, title: '—', url: null },
  { face: 8, title: '—', url: null },
  { face: 9, title: '—', url: null },
  { face: 10, title: '—', url: null },
  { face: 11, title: '—', url: null },
  { face: 12, title: '—', url: null },
  { face: 13, title: '—', url: null },
  { face: 14, title: '—', url: null },
  { face: 15, title: '—', url: null },
  { face: 16, title: '—', url: null },
  { face: 17, title: '—', url: null },
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
  { face: 1, title: 'BLOG', url: 'https://randomjin.top/blog' },
  { face: 2, title: 'LAB', url: 'https://randomjin.top/lab' },
  { face: 3, title: 'DUDU', url: 'https://randomjin.top/dudu' },
  { face: 4, title: 'FRIENDS', url: 'https://randomjin.top/friends' },
  { face: 5, title: 'ABOUT ME', url: 'https://randomjin.top/aboutme' },
  { face: 6, title: '—', url: null },
  { face: 7, title: '—', url: null },
  { face: 8, title: '—', url: null },
  { face: 9, title: '—', url: null },
  { face: 10, title: '—', url: null },
  { face: 11, title: '—', url: null },
  { face: 12, title: '—', url: null },
];

/**
 * 「随机投掷」的候选页面，与骰子的面无关：整站页面多于面数时，
 * 直接把新条目加到这里即可参与随机。
 */
export const ROLL_PAGES: RollPage[] = [
  { title: 'BLOG', url: 'https://randomjin.top/blog' },
  { title: 'LAB', url: 'https://randomjin.top/lab' },
  { title: 'DUDU', url: 'https://randomjin.top/dudu' },
  { title: 'FRIENDS', url: 'https://randomjin.top/friends' },
  { title: 'ABOUT ME', url: 'https://randomjin.top/aboutme' },
];

export const pageOfFace = (face: number): DicePage | undefined =>
  DICE_PAGES.find((page) => page.face === face);
