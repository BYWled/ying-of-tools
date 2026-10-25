/**
 * SEO 产物生成：
 *   pre  —— 解析 src/config/tools.tsx 的工具清单，生成 public/sitemap.xml
 *   post —— 读取 dist/index.html，为每个工具生成带专属 meta 的 dist/tool/<id>.html
 *           （Workers Assets 的 clean-URL 会把 /tool/<id> 直接映射到该文件，
 *            不执行 JS 的搜索引擎也能拿到每个工具的独立标题与描述）
 */
import fs from 'node:fs'
import path from 'node:path'

const SITE = 'https://tools.wled.top'
const ROOT = path.resolve(import.meta.dirname, '..')

/** 从工具注册表源码解析工具清单（保持零依赖，格式变化时构建会显式失败） */
function parseTools() {
  const src = fs.readFileSync(path.join(ROOT, 'src/config/tools.tsx'), 'utf-8')
  const tools = []
  // 块结构：两空格缩进的 `{ ... },`，字段四空格缩进
  const blockRe = /\{\s*\n\s{4}id:\s*'([^']+)',\s*\n([\s\S]*?)\n\s{2}\},?/g
  let m
  while ((m = blockRe.exec(src)) !== null) {
    const id = m[1]
    const body = m[2]
    const category = /category:\s*'([^']+)'/.exec(body)?.[1]
    const title = /title:\s*'([^']+)'/.exec(body)?.[1]
    // desc 可能含模板不支持的字符，注册表统一单引号字符串
    const desc = /desc:\s*'([^']+)'/.exec(body)?.[1] ?? ''
    const formats = (/formats:\s*\[([^\]]*)\]/.exec(body)?.[1] ?? '')
      .split(',')
      .map((s) => s.trim().replace(/^'|'$/g, ''))
      .filter(Boolean)
    const popular = /popular:\s*true/.test(body)
    if (id && category && title) tools.push({ id, category, title, desc, formats, popular })
  }
  return tools
}

function genSitemap(tools) {
  const today = new Date().toISOString().slice(0, 10)
  const urls = [
    `  <url><loc>${SITE}/</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    ...tools.map(
      (t) =>
        `  <url><loc>${SITE}/tool/${t.id}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>${t.popular ? '0.8' : '0.6'}</priority></url>`,
    ),
  ]
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
  fs.writeFileSync(path.join(ROOT, 'public/sitemap.xml'), xml)
  console.log(`[seo] sitemap.xml: ${tools.length + 1} urls`)
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** 替换 index.html 中带 data-seo-* 标记的节点内容 */
function inject(html, { title, description, keywords, canonical, ogTitle, ogDesc, jsonld, noscriptBody }) {
  let out = html
  out = out.replace(/<title data-seo-title>[\s\S]*?<\/title>/, `<title data-seo-title>${esc(title)}</title>`)
  out = out.replace(
    /<meta\s+data-seo-desc\s+name="description"\s+content="[^"]*"\s*\/?>/,
    `<meta data-seo-desc name="description" content="${esc(description)}" />`,
  )
  out = out.replace(
    /<meta\s+data-seo-keywords\s+name="keywords"\s+content="[^"]*"\s*\/?>/,
    `<meta data-seo-keywords name="keywords" content="${esc(keywords)}" />`,
  )
  out = out.replace(
    /<link data-seo-canonical rel="canonical" href="[^"]*" \/>/,
    `<link data-seo-canonical rel="canonical" href="${esc(canonical)}" />`,
  )
  out = out.replace(
    /<meta data-seo-og-title property="og:title" content="[^"]*" \/>/,
    `<meta data-seo-og-title property="og:title" content="${esc(ogTitle)}" />`,
  )
  out = out.replace(
    /<meta\s+data-seo-og-desc\s+property="og:description"\s+content="[^"]*"\s*\/?>/,
    `<meta data-seo-og-desc property="og:description" content="${esc(ogDesc)}" />`,
  )
  out = out.replace(
    /<meta property="og:url" content="[^"]*" \/>/,
    `<meta property="og:url" content="${esc(canonical)}" />`,
  )
  out = out.replace(
    /<script data-seo-jsonld type="application\/ld\+json">[\s\S]*?<\/script>/,
    `<script data-seo-jsonld type="application/ld+json">${JSON.stringify(jsonld)}</script>`,
  )
  // 工具页不再携带首页 FAQ 结构化数据
  out = out.replace(/<script data-seo-faq type="application\/ld\+json">[\s\S]*?<\/script>/, '')
  if (noscriptBody) {
    out = out.replace(/<noscript>[\s\S]*?<\/noscript>/, `<noscript>${noscriptBody}</noscript>`)
  }
  return out
}

function genToolPages(tools) {
  const dist = path.join(ROOT, 'dist')
  const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf-8')
  const dir = path.join(dist, 'tool')
  fs.mkdirSync(dir, { recursive: true })
  const suffix = '- 免费在线工具 | 伴莺的工具箱'
  for (const t of tools) {
    const url = `${SITE}/tool/${t.id}`
    const title = `${t.title} ${suffix}`
    const description = `${t.desc}。纯浏览器本地处理，文件不上传，免费无限制。`
    const keywords = [t.title, '在线工具', '免费', t.category, ...t.formats].filter(Boolean).join(',')
    const jsonld = {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: t.title,
      url,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Web',
      description: t.desc,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'CNY' },
    }
    const noscript = `<h1>${esc(t.title)}</h1><p>${esc(t.desc)}</p><p>免费在线工具，浏览器本地处理、文件不上传。<a href="/">返回伴莺的工具箱首页查看全部 57 个工具</a>。本站需要启用 JavaScript。</p>`
    const page = inject(html, {
      title,
      description,
      keywords,
      canonical: url,
      ogTitle: title,
      ogDesc: description,
      jsonld,
      noscriptBody: noscript,
    })
    fs.writeFileSync(path.join(dir, `${t.id}.html`), page)
  }
  console.log(`[seo] generated ${tools.length} tool pages in dist/tool/`)
}

const mode = process.argv[2]
const tools = parseTools()
if (tools.length === 0) {
  console.error('[seo] 未解析到任何工具——tools.tsx 注册表格式可能已变化，请更新 scripts/generate-seo.mjs')
  process.exit(1)
}
if (mode === 'pre') {
  genSitemap(tools)
} else if (mode === 'post') {
  genToolPages(tools)
} else {
  console.error('usage: node scripts/generate-seo.mjs pre|post')
  process.exit(1)
}
