import { SITE } from '@/config/site'

/**
 * SPA 路由级 SEO：切换页面时同步 document.title 与 meta。
 * 构建期为每个工具生成的静态 HTML 已带专属 meta；这里覆盖客户端
 * 路由导航（无整页加载）时的标题/描述，避免所有页面显示同一标题。
 */
export function setSeo({ title, description }: { title: string; description: string }) {
  if (document.title !== title) document.title = title
  const setMeta = (selector: string, attr: string, content: string) => {
    document.querySelectorAll(selector).forEach((el) => el.setAttribute(attr, content))
  }
  setMeta('meta[name="description"]', 'content', description)
  setMeta('meta[property="og:title"]', 'content', title)
  setMeta('meta[property="og:description"]', 'content', description)
}

export const HOME_SEO = {
  title: `${SITE.name} · 免费在线工具集：格式转换 / PDF / 图片 / 音视频 / 文本`,
  description:
    '57 个免费在线工具：图片格式转换与压缩、PDF 合并拆分加密、视频转 GIF、音频剪辑、HEIC 转 JPG、OCR 文字识别、二维码、文本差异对比、时间戳 / JSON / 正则等开发工具。全部浏览器本地处理，文件不上传。',
}

export const TOOL_SEO_SUFFIX = '- 免费在线工具 | 伴莺的工具箱'
