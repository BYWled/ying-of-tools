import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { ConverterModule, ResultFile } from '@/config/types'
import { baseName } from '@/lib/utils'
import { loadPdf, pdfDocOf, renderPageToBlob, runQpdf } from './pdf'

const MIME = 'application/pdf'

async function blobToPngBlob(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
  bitmap.close()
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('图片转换失败'))), 'image/png'),
  )
}

/** 生成整页水印叠加层（canvas 渲染，支持中文） */
async function makeWatermarkOverlay(
  wPt: number,
  hPt: number,
  opts: { text: string; fontSize: number; opacity: number; color: string; density: 'tile' | 'center'; angle: number },
): Promise<Blob> {
  const scale = 2
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(wPt * scale)
  canvas.height = Math.ceil(hPt * scale)
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = opts.color
  ctx.globalAlpha = opts.opacity
  ctx.font = `600 ${opts.fontSize * scale}px 'Roboto Variable', 'Microsoft YaHei', sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const rad = (-opts.angle * Math.PI) / 180
  const textW = ctx.measureText(opts.text).width

  const drawOne = (cx: number, cy: number) => {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(rad)
    ctx.fillText(opts.text, 0, 0)
    ctx.restore()
  }

  if (opts.density === 'center') {
    drawOne(canvas.width / 2, canvas.height / 2)
  } else {
    const stepX = Math.max(textW * 1.6, 240 * scale)
    const stepY = Math.max(opts.fontSize * 6 * scale, 180 * scale)
    for (let y = stepY / 2; y < canvas.height + stepY; y += stepY) {
      for (let x = -stepX / 2, row = 0; x < canvas.width + stepX; x += stepX, row++) {
        drawOne(x + (row % 2 ? stepX / 2 : 0), y)
      }
    }
  }
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('水印渲染失败'))), 'image/png'),
  )
}

/* ─────────────────────────── 合并 ─────────────────────────── */

export const pdfMerge: ConverterModule = {
  mergeMode: true,
  fields: [],
  async run(files) {
    if (files.length < 2) throw new Error('请至少添加两个 PDF 文件')
    const out = await PDFDocument.create()
    for (const file of files) {
      const doc = await pdfDocOf(file)
      const pages = await out.copyPages(doc, doc.getPageIndices())
      pages.forEach((p) => out.addPage(p))
    }
    const bytes = await out.save()
    return [{ name: '合并结果.pdf', blob: new Blob([bytes as unknown as BlobPart], { type: MIME }) }]
  },
}

/* ─────────────────────────── 拆分 ─────────────────────────── */

export const pdfSplit: ConverterModule = {
  fields: [
    {
      key: 'mode',
      label: '拆分方式',
      type: 'select',
      default: 'ranges',
      options: [
        { value: 'ranges', label: '按页码范围' },
        { value: 'each', label: '每一页一个文件' },
        { value: 'every', label: '每 N 页一个文件' },
      ],
    },
    {
      key: 'ranges',
      label: '页码范围',
      type: 'text',
      default: '1-1',
      placeholder: '如 1-3,5,8-10',
      showIf: (s) => s.mode === 'ranges',
      hint: '用逗号分隔多个范围，每个范围生成一个 PDF',
    },
    {
      key: 'every',
      label: '每份页数',
      type: 'slider',
      default: 2,
      min: 1,
      max: 50,
      showIf: (s) => s.mode === 'every',
    },
  ],
  async run([file], s, ctx) {
    const doc = await pdfDocOf(file)
    const total = doc.getPageCount()
    const base = baseName(file.name)

    let groups: { from: number; to: number }[] = []
    if (s.mode === 'each') {
      for (let i = 1; i <= total; i++) groups.push({ from: i, to: i })
    } else if (s.mode === 'every') {
      const n = Number(s.every) || 1
      for (let i = 1; i <= total; i += n) groups.push({ from: i, to: Math.min(total, i + n - 1) })
    } else {
      const raw = String(s.ranges ?? '')
      for (const part of raw.split(/[,，]/)) {
        const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/)
        if (!m) continue
        const from = Math.max(1, parseInt(m[1], 10))
        const to = Math.min(total, parseInt(m[2] ?? m[1], 10))
        if (from <= to) groups.push({ from, to })
      }
      if (!groups.length) throw new Error('页码范围格式不正确，示例：1-3,5,8-10')
    }

    const results: ResultFile[] = []
    for (let i = 0; i < groups.length; i++) {
      const { from, to } = groups[i]
      const out = await PDFDocument.create()
      const pages = await out.copyPages(doc, Array.from({ length: to - from + 1 }, (_, k) => from - 1 + k))
      pages.forEach((p) => out.addPage(p))
      const bytes = await out.save()
      const label = from === to ? `第${from}页` : `第${from}-${to}页`
      results.push({
        name: `${base}-${label}.pdf`,
        blob: new Blob([bytes as unknown as BlobPart], { type: MIME }),
      })
      ctx.onProgress((i + 1) / groups.length)
    }
    return results
  },
}

/* ─────────────────────────── 压缩 ─────────────────────────── */

export const pdfCompress: ConverterModule = {
  fields: [
    {
      key: 'dpi',
      label: '渲染清晰度',
      type: 'select',
      default: '120',
      options: [
        { value: '72', label: '72 DPI · 最小' },
        { value: '96', label: '96 DPI · 较小' },
        { value: '120', label: '120 DPI · 均衡' },
        { value: '150', label: '150 DPI · 较清晰' },
        { value: '200', label: '200 DPI · 高清晰' },
      ],
      hint: '压缩采用整页重绘方式，文字会变成图片（不可选中）',
    },
    { key: 'quality', label: '图片质量', type: 'slider', default: 75, min: 30, max: 95, suffix: '%' },
    { key: 'grayscale', label: '转为灰度（进一步减小体积）', type: 'toggle', default: false },
  ],
  async run([file], s, ctx) {
    const src = await loadPdf(file)
    const out = await PDFDocument.create()
    const type = 'image/jpeg' as const
    for (let i = 1; i <= src.numPages; i++) {
      const { blob, widthPt, heightPt } = await renderPageToBlob(src, i, {
        dpi: Number(s.dpi),
        type,
        quality: Number(s.quality) / 100,
      })
      let embedded = await out.embedJpg(await blob.arrayBuffer())
      if (s.grayscale) {
        const bitmap = await createImageBitmap(blob)
        const canvas = document.createElement('canvas')
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        const c = canvas.getContext('2d')!
        c.filter = 'grayscale(1)'
        c.drawImage(bitmap, 0, 0)
        bitmap.close()
        const grayBlob = await new Promise<Blob>((res, rej) =>
          canvas.toBlob((b) => (b ? res(b) : rej(new Error('灰度转换失败'))), 'image/jpeg', Number(s.quality) / 100),
        )
        embedded = await out.embedJpg(await grayBlob.arrayBuffer())
      }
      const page = out.addPage([widthPt, heightPt])
      page.drawImage(embedded, { x: 0, y: 0, width: widthPt, height: heightPt })
      ctx.onProgress(i / src.numPages)
    }
    const bytes = await out.save({ useObjectStreams: true })
    const name = `${baseName(file.name)}-压缩.pdf`
    return [{ name, blob: new Blob([bytes as unknown as BlobPart], { type: MIME }) }]
  },
}

/* ─────────────────────────── 图片合成 PDF ─────────────────────────── */

export const imagesToPdf: ConverterModule = {
  mergeMode: true,
  fields: [
    {
      key: 'pageSize',
      label: '页面尺寸',
      type: 'select',
      default: 'auto',
      options: [
        { value: 'auto', label: '随图片尺寸' },
        { value: 'a4', label: 'A4 纵向（图片等比适配）' },
      ],
    },
    { key: 'margin', label: '页边距', type: 'slider', default: 12, min: 0, max: 60, suffix: ' pt' },
  ],
  async run(files, s, ctx) {
    if (!files.length) throw new Error('请先添加图片')
    const out = await PDFDocument.create()
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      let blob: Blob = file
      if (!(file.type === 'image/png' || file.type === 'image/jpeg')) {
        blob = await blobToPngBlob(file)
      }
      const bitmap = await createImageBitmap(blob)
      let img
      if (blob.type === 'image/jpeg') img = await out.embedJpg(await blob.arrayBuffer())
      else img = await out.embedPng(await blob.arrayBuffer())

      if (s.pageSize === 'a4') {
        const [pw, ph] = [595.28, 841.89]
        const page = out.addPage([pw, ph])
        const m = Number(s.margin)
        const maxW = pw - m * 2
        const maxH = ph - m * 2
        const ratio = Math.min(maxW / bitmap.width, maxH / bitmap.height)
        const w = bitmap.width * ratio
        const h = bitmap.height * ratio
        page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h })
      } else {
        const m = Number(s.margin)
        const page = out.addPage([bitmap.width + m * 2, bitmap.height + m * 2])
        page.drawImage(img, { x: m, y: m, width: bitmap.width, height: bitmap.height })
      }
      bitmap.close()
      ctx.onProgress((i + 1) / files.length)
    }
    const bytes = await out.save()
    return [{ name: '图片合集.pdf', blob: new Blob([bytes as unknown as BlobPart], { type: MIME }) }]
  },
}

/* ─────────────────────────── PDF 转图片 ─────────────────────────── */

export const pdfToImages: ConverterModule = {
  fields: [
    {
      key: 'type',
      label: '图片格式',
      type: 'select',
      default: 'image/png',
      options: [
        { value: 'image/png', label: 'PNG（无损）' },
        { value: 'image/jpeg', label: 'JPG（体积小）' },
      ],
    },
    {
      key: 'dpi',
      label: '清晰度',
      type: 'select',
      default: '150',
      options: [
        { value: '96', label: '96 DPI · 屏幕阅读' },
        { value: '150', label: '150 DPI · 均衡' },
        { value: '220', label: '220 DPI · 高清' },
        { value: '300', label: '300 DPI · 印刷' },
      ],
    },
    { key: 'quality', label: 'JPG 质量', type: 'slider', default: 90, min: 50, max: 100, showIf: (s) => s.type === 'image/jpeg' },
  ],
  async run([file], s, ctx) {
    const doc = await loadPdf(file)
    const base = baseName(file.name)
    const ext = s.type === 'image/jpeg' ? 'jpg' : 'png'
    const results: ResultFile[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      const { blob } = await renderPageToBlob(doc, i, {
        dpi: Number(s.dpi),
        type: s.type as 'image/png' | 'image/jpeg',
        quality: Number(s.quality) / 100,
      })
      results.push({ name: `${base}-第${i}页.${ext}`, blob })
      ctx.onProgress(i / doc.numPages)
    }
    return results
  },
}

/* ─────────────────────────── 加密 / 解密 / 修复 ─────────────────────────── */

export const pdfProtect: ConverterModule = {
  fields: [
    {
      key: 'mode',
      label: '操作',
      type: 'select',
      default: 'encrypt',
      options: [
        { value: 'encrypt', label: '加密（设置打开密码）' },
        { value: 'decrypt', label: '解密（去除已知密码）' },
        { value: 'repair', label: '修复损坏的 PDF' },
      ],
    },
    { key: 'password', label: '打开密码', type: 'text', default: '', showIf: (s) => s.mode !== 'repair', placeholder: '必填' },
    {
      key: 'ownerPassword',
      label: '权限密码（可选）',
      type: 'text',
      default: '',
      showIf: (s) => s.mode === 'encrypt',
      hint: '不填则与打开密码相同',
    },
  ],
  async run([file], s) {
    const base = baseName(file.name)
    if (s.mode === 'repair') {
      const blob = await runQpdf(file, ['/in/input.pdf', '--repair'])
      return [{ name: `${base}-修复.pdf`, blob }]
    }
    const pwd = String(s.password ?? '').trim()
    if (!pwd) throw new Error('请输入密码')
    if (s.mode === 'encrypt') {
      const owner = String(s.ownerPassword ?? '').trim() || pwd
      const blob = await runQpdf(file, ['/in/input.pdf', '--encrypt', pwd, owner, '256', '--'])
      return [{ name: `${base}-加密.pdf`, blob }]
    }
    const blob = await runQpdf(file, [`--password=${pwd}`, '--decrypt', '/in/input.pdf'])
    return [{ name: `${base}-解密.pdf`, blob }]
  },
}

/* ─────────────────────────── 页码 ─────────────────────────── */

export const pdfPageNumbers: ConverterModule = {
  fields: [
    {
      key: 'format',
      label: '页码格式',
      type: 'select',
      default: 'n',
      options: [
        { value: 'n', label: '1' },
        { value: 'n-of-n', label: '1 / 10' },
        { value: 'page-n', label: 'Page 1' },
        { value: 'page-n-of-n', label: 'Page 1 / 10' },
      ],
    },
    {
      key: 'position',
      label: '位置',
      type: 'select',
      default: 'bottom-center',
      options: [
        { value: 'bottom-center', label: '底部居中' },
        { value: 'bottom-right', label: '底部右侧' },
        { value: 'bottom-left', label: '底部左侧' },
        { value: 'top-center', label: '顶部居中' },
        { value: 'top-right', label: '顶部右侧' },
        { value: 'top-left', label: '顶部左侧' },
      ],
    },
    { key: 'start', label: '起始编号', type: 'slider', default: 1, min: 1, max: 100 },
    { key: 'size', label: '字号', type: 'slider', default: 10, min: 6, max: 24 },
  ],
  async run([file], s) {
    const doc = await pdfDocOf(file)
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const pages = doc.getPages()
    const total = pages.length
    pages.forEach((page, idx) => {
      const n = idx + Number(s.start)
      const text =
        s.format === 'n'
          ? `${n}`
          : s.format === 'n-of-n'
            ? `${n} / ${total + Number(s.start) - 1}`
            : s.format === 'page-n'
              ? `Page ${n}`
              : `Page ${n} / ${total + Number(s.start) - 1}`
      const { width, height } = page.getSize()
      const tw = font.widthOfTextAtSize(text, Number(s.size))
      const margin = 24
      const pos = String(s.position)
      const x = pos.endsWith('left') ? margin : pos.endsWith('right') ? width - margin - tw : (width - tw) / 2
      const y = pos.startsWith('top') ? height - margin - Number(s.size) : margin
      page.drawText(text, { x, y, size: Number(s.size), font, color: rgb(0.35, 0.35, 0.35) })
    })
    const bytes = await doc.save()
    return [{ name: `${baseName(file.name)}-页码.pdf`, blob: new Blob([bytes as unknown as BlobPart], { type: MIME }) }]
  },
}

/* ─────────────────────────── 水印 ─────────────────────────── */

export const pdfWatermark: ConverterModule = {
  fields: [
    { key: 'text', label: '水印文字', type: 'text', default: '仅供内部使用', placeholder: '支持中文' },
    {
      key: 'density',
      label: '布局',
      type: 'select',
      default: 'tile',
      options: [
        { value: 'tile', label: '平铺全页' },
        { value: 'center', label: '居中单个' },
      ],
    },
    { key: 'fontSize', label: '字号', type: 'slider', default: 36, min: 12, max: 96 },
    { key: 'opacity', label: '不透明度', type: 'slider', default: 12, min: 3, max: 50, suffix: '%' },
    { key: 'angle', label: '旋转角度', type: 'slider', default: 30, min: -90, max: 90, suffix: '°' },
    {
      key: 'color',
      label: '颜色',
      type: 'select',
      default: 'gray',
      options: [
        { value: 'gray', label: '灰色' },
        { value: 'black', label: '黑色' },
        { value: 'white', label: '白色' },
        { value: 'teal', label: '青绿' },
      ],
    },
  ],
  async run([file], s, ctx) {
    const doc = await pdfDocOf(file)
    const pages = doc.getPages()
    const colorMap: Record<string, string> = {
      gray: 'rgba(128,128,128,1)',
      black: 'rgba(0,0,0,1)',
      white: 'rgba(255,255,255,1)',
      teal: 'rgba(31,142,131,1)',
    }
    let lastOverlay: Blob | null = null
    let lastKey = ''
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i]
      const { width, height } = page.getSize()
      const key = `${Math.round(width)}x${Math.round(height)}`
      if (key !== lastKey || !lastOverlay) {
        lastOverlay = await makeWatermarkOverlay(width, height, {
          text: String(s.text || '水印'),
          fontSize: Number(s.fontSize),
          opacity: Number(s.opacity) / 100,
          color: colorMap[String(s.color)] ?? colorMap.gray,
          density: s.density as 'tile' | 'center',
          angle: Number(s.angle),
        })
        lastKey = key
      }
      const img = await doc.embedPng(await lastOverlay.arrayBuffer())
      page.drawImage(img, { x: 0, y: 0, width, height })
      ctx.onProgress((i + 1) / pages.length)
    }
    const bytes = await doc.save()
    return [{ name: `${baseName(file.name)}-水印.pdf`, blob: new Blob([bytes as unknown as BlobPart], { type: MIME }) }]
  },
}

/* ─────────────────────────── 元数据 ─────────────────────────── */

export const pdfMetadata: ConverterModule = {
  fields: [
    { key: 'title', label: '标题', type: 'text', default: '', placeholder: '留空保持原样' },
    { key: 'author', label: '作者', type: 'text', default: '', placeholder: '留空保持原样' },
    { key: 'subject', label: '主题', type: 'text', default: '', placeholder: '留空保持原样' },
    { key: 'keywords', label: '关键词', type: 'text', default: '', placeholder: '逗号分隔；留空保持原样' },
    { key: 'strip', label: '清除生成器信息（隐去制作者痕迹）', type: 'toggle', default: false },
  ],
  async run([file], s) {
    const doc = await pdfDocOf(file)
    const title = String(s.title ?? '').trim()
    const author = String(s.author ?? '').trim()
    const subject = String(s.subject ?? '').trim()
    const keywords = String(s.keywords ?? '').trim()
    if (title) doc.setTitle(title)
    if (author) doc.setAuthor(author)
    if (subject) doc.setSubject(subject)
    if (keywords) doc.setKeywords(keywords.split(/[,，]/).map((k) => k.trim()).filter(Boolean))
    if (s.strip) {
      doc.setProducer('')
      doc.setCreator('')
    }
    const bytes = await doc.save()
    return [{ name: `${baseName(file.name)}-信息.pdf`, blob: new Blob([bytes as unknown as BlobPart], { type: MIME }) }]
  },
}
