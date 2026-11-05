/**
 * 构建前生成「随机投掷」页面池 src/config/rollPool.json。
 *
 * 来源：
 *  1. 主站：直接扫描 src/pages 下所有 .astro 页面（存相对路径，dev 环境用本地路由）
 *  2. blog：抓 sitemap-index.xml（内含 vercel.app 预览域名时统一改写为线上域名）
 *  3. lab：无 sitemap 时从首页爬取同域链接（深度 1）；装上 @astrojs/sitemap 后自动优先走 sitemap
 *
 * 任一子站抓取失败只发出警告并保留上一次生成的 rollPool.json，不阻塞构建。
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const PAGES_DIR = join(ROOT, 'src', 'pages');
const OUT_FILE = join(ROOT, 'src', 'config', 'rollPool.json');

const SITES = [
  {
    label: 'BLOG',
    origin: 'https://blog.randomjin.top',
    sitemap: ['https://blog.randomjin.top/sitemap-index.xml', 'https://blog.randomjin.top/sitemap-0.xml'],
    rewriteHosts: ['https://blog-theta-seven-58.vercel.app'],
  },
  {
    label: 'LAB',
    origin: 'https://lab.randomjin.top',
    sitemap: ['https://lab.randomjin.top/sitemap-index.xml', 'https://lab.randomjin.top/sitemap-0.xml'],
  },
];

/** 主站页面标题映射（与 dice.config 里的叫法保持一致） */
const LOCAL_TITLES = {
  '/': 'HOME',
  '/about': 'ABOUT ME',
  '/friends': 'FRIENDS',
};

const isPageUrl = (u) => !/\.(xml|png|jpe?g|gif|webp|svg|ico|css|js|mjs|txt|woff2?|ttf|pdf|zip)$/i.test(u);

async function fetchText(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

/** 抓 sitemap（支持 index 递归），返回页面 URL 列表 */
async function fetchSitemap(url, site, seen = new Set()) {
  if (seen.has(url)) return [];
  seen.add(url);
  const xml = await fetchText(url);
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  const nested = locs.filter((l) => l.endsWith('.xml'));
  if (nested.length) {
    const pages = await Promise.all(nested.map((l) => fetchSitemap(l, site, seen)));
    return pages.flat();
  }
  return locs
    .map((u) => {
      // 子站 sitemap 里可能写着部署预览域名，统一改写成线上域名
      for (const host of site.rewriteHosts ?? []) {
        if (u.startsWith(host)) return site.origin + u.slice(host.length);
      }
      return u;
    })
    .filter((u) => u.startsWith(site.origin) && isPageUrl(u));
}

/** lab 兜底：从首页爬同域链接，depth 层 */
async function crawlSite(site, depth = 1) {
  const found = new Set([site.origin + '/']);
  let frontier = [site.origin + '/'];
  for (let d = 0; d < depth; d++) {
    const next = [];
    for (const url of frontier) {
      let html;
      try {
        html = await fetchText(url);
      } catch {
        continue;
      }
      for (const m of html.matchAll(/href="([^"#]+)"/g)) {
        let href = m[1];
        if (/^(https?:)?\/\//.test(href)) {
          if (!href.startsWith(site.origin)) continue; // 外链
        } else if (href.startsWith('/')) {
          href = site.origin + href;
        } else {
          continue;
        }
        const clean = href.replace(/\/$/, '') || site.origin + '/';
        if (isPageUrl(clean) && !found.has(clean)) {
          found.add(clean);
          next.push(clean);
        }
      }
    }
    frontier = next;
  }
  return [...found];
}

function localPages() {
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = join(dir, e.name);
      return e.isDirectory() ? walk(p) : p.endsWith('.astro') ? [p] : [];
    });
  return walk(PAGES_DIR)
    .map((p) => {
      const rel = relative(PAGES_DIR, p).split(sep).join('/');
      const path = '/' + rel.replace(/(^|\/)index\.astro$/, '').replace(/\.astro$/, '');
      return { path: path === '/index' ? '/' : path };
    });
}

/** 规范化 URL：仅根路径保留尾斜杠，其余去掉，避免同一页面出现两个变体 */
const normalizeUrl = (u) => {
  try {
    const { origin, pathname } = new URL(u);
    return pathname === '/' || pathname === '' ? origin + '/' : origin + pathname.replace(/\/+$/, '');
  } catch {
    return u;
  }
};

/** 从 URL 推导展示标题：BLOG · slug / LAB · slug / HOME */
function titleFor(entry) {
  if (entry.path) return LOCAL_TITLES[entry.path] ?? entry.path;
  const site = SITES.find((s) => entry.url.startsWith(s.origin));
  const label = site ? site.label : 'PAGE';
  try {
    const { pathname } = new URL(entry.url);
    const seg = decodeURIComponent(pathname.replace(/^\//, '').replace(/\/$/, ''));
    return seg ? `${label} · ${seg}` : label;
  } catch {
    return label;
  }
}

async function main() {
  const entries = [...localPages()];

  for (const site of SITES) {
    try {
      let urls = null;
      for (const sm of site.sitemap) {
        try {
          urls = await fetchSitemap(sm, site);
          if (urls.length) break;
        } catch { /* 尝试下一个候选地址 */ }
      }
      if (!urls || !urls.length) {
        console.warn(`[roll-pool] ${site.label} 无可用 sitemap，改用爬取首页`);
        urls = await crawlSite(site);
      }
      for (const raw of urls) entries.push({ url: normalizeUrl(raw) });
      console.log(`[roll-pool] ${site.label}: ${urls.length} 个页面`);
    } catch (err) {
      console.warn(`[roll-pool] ${site.label} 抓取失败，跳过：${err.message}`);
    }
  }

  const pool = entries
    .map((e) => ({ title: titleFor(e), ...e }))
    // 去重：path 或 url 相同只保留一个
    .filter((e, i, arr) => arr.findIndex((o) => (o.path ?? o.url) === (e.path ?? e.url)) === i);

  if (pool.length <= entries.filter((e) => e.path).length) {
    // 三个子站全部失败且没有旧文件兜底时给出提示，但依然写主站页面
    if (!existsSync(OUT_FILE)) console.warn('[roll-pool] 子站全部抓取失败，页面池仅含主站页面');
  }

  writeFileSync(OUT_FILE, JSON.stringify(pool, null, 2) + '\n');
  console.log(`[roll-pool] 已写入 ${OUT_FILE}（共 ${pool.length} 项）`);
}

main().catch((err) => {
  console.error('[roll-pool] 生成失败：', err);
  process.exit(1);
});
