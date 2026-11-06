/**
 * 时间线内容配置。
 *
 * 年份按升序书写，唱片上的年轮会由内向外对应排列；
 * 右侧卡片按「年份 → 条目」顺序拍平后逐条播放。
 * 只需要改这个文件就能更新整页内容。
 */

export interface TimelineImage {
  /** 图片地址，建议使用 img.randomjin.top */
  src: string;
  alt: string;
}

export interface TimelineItem {
  /** 展示用日期，形如 03.12 */
  date: string;
  title: string;
  description: string;
  image?: TimelineImage;
}

export interface TimelineYear {
  year: number;
  items: TimelineItem[];
}

export const TIMELINE: TimelineYear[] = [
  {
    year: 2023,
    items: [
      {
        date: '01.15',
        title: '从这里开始记',
        description: '搭好这个小小的角落，先把字号和行高调到看着舒服为止。',
      },
      {
        date: '06.03',
        title: '换成黑白配色',
        description: '把能去掉的颜色都去掉，只留文字、细线和留白。',
      },
      {
        date: '11.20',
        title: '第一个自己的域名',
        description: 'randomjin.top 上线，开始在互联网上有一个固定的门牌。',
      },
    ],
  },
  {
    year: 2024,
    items: [
      {
        date: '03.08',
        title: '博客搬到新家',
        description: '把写文章的部分独立出去，换成一个更安静的子域名。',
      },
      {
        date: '07.21',
        title: '做了第一件小工具',
        description: '从需求、界面到部署自己走了一遍，才知道收尾比开工难。',
      },
    ],
  },
  {
    year: 2025,
    items: [
      {
        date: '02.14',
        title: '三个站点各自独立',
        description: '主站、博客、实验室拆开，各自管自己的事情，首页只负责投骰子。',
      },
      {
        date: '09.09',
        title: '把图床换到 CDN',
        description: '所有图片统一走 img.randomjin.top，页面加载终于稳定下来。',
      },
    ],
  },
  {
    year: 2026,
    items: [
      {
        date: '03.12',
        title: '把网站搬进一间小屋',
        description: '给个站换上一套木质色调，把首页的小房间重新布置了一遍。',
      },
      {
        date: '08.06',
        title: '给个站加了一张唱片',
        description: '用一张黑胶唱片装下这些年，滚轮就是唱针的位置。',
      },
    ],
  },
];
