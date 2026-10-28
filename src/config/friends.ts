export interface Friend {
  name: string;
  description: string;
  link: string;
  avatar: string;
}

export interface MyCard {
  name: string;
  description: string;
  link: string;
  /** 页面展示用的头像地址 */
  avatar: string;
  /** 复制用的绝对地址 */
  avatarUrl: string;
}

export const FRIENDS: Friend[] = [
  {
    name: "SanXiaoXing",
    description: "开心每一天",
    link: "https://blog.sanxiaoxing.cn/",
    avatar: "https://blog.sanxiaoxing.cn/favicon.svg",
  },
];

export const MY_CARD: MyCard = {
  name: "今斤",
  description: "吾日三省吾身，今日几斤？",
  link: "https://randomjin.top/",
  avatar: "/logo.png",
  avatarUrl: "https://randomjin.top/logo.png",
};
