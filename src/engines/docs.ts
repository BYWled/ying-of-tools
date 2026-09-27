import mammoth from 'mammoth'
import TurndownService from 'turndown'
import { marked } from 'marked'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import type { ConverterModule, FieldOption, ResultFile } from '@/config/types'
import { baseName, extOf } from '@/lib/utils'
import { extractPdfText, loadPdf } from './pdf'

/* ─────────────────────────── 目标格式表 ─────────────────────────── */

const TARGETS: Record<string, { value: string; label: string }[]> = {
  docx: [
    { value: 'md', label: 'Markdown (.md)' },
    { value: 'html', label: 'HTML (.html)' },
    { value: 'txt', label: '纯文本 (.txt)' },
    { value: 'pdf', label: 'PDF（栅格化导出，页内预览确认）' },
  ],
  md: [
    { value: 'html', label: 'HTML (.html)' },
    { value: 'docx', label: 'Word (.docx)' },
    { value: 'pdf', label: 'PDF（排版导出）' },
    { value: 'txt', label: '纯文本 (.txt)' },
  ],
  html: [
    { value: 'md', label: 'Markdown (.md)' },
    { value: 'pdf', label: 'PDF（排版导出）' },
    { value: 'txt', label: '纯文本 (.txt)' },
  ],
  txt: [
    { value: 'md', label: 'Markdown (.md)' },
    { value: 'pdf', label: 'PDF（排版导出）' },
  ],
  xlsx: [
    { value: 'csv', label: 'CSV (.csv)' },
    { value: 'json', label: 'JSON (.json)' },
  ],
  xls: [
    { value: 'csv', label: 'CSV (.csv)' },
    { value: 'json', label: 'JSON (.json)' },
  ],
  csv: [
    { value: 'xlsx', label: 'Excel (.xlsx)' },
    { value: 'json', label: 'JSON (.json)' },
  ],
  json: [
    { value: 'xlsx', label: 'Excel (.xlsx)' },
    { value: 'csv', label: 'CSV (.csv)' },
  ],
  pdf: [
    { value: 'txt', label: '纯文本 (.txt)' },
    { value: 'md', label: 'Markdown（纯文本提取）(.md)' },
  ],
}

function targetsFor(files: File[]): FieldOption[] {
  if (!files.length) {
    return [{ value: '', label: '先添加文件' }]
  }
  const ext = extOf(files[0].name)
  return TARGETS[ext] ?? []
}

const textBlob = (text: string, mime = 'text/plain') =>
  new Blob([text], { type: `${mime};charset=utf-8` })

const HTML_SHELL = (inner: string) =>
  `<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n<title>文档</title>\n<style>body{max-width:820px;margin:40px auto;padding:0 20px;font-family:'Roboto Variable','PingFang SC','Microsoft YaHei',sans-serif;line-height:1.7;color:#1a1a1a}pre{background:#f4f6f6;padding:12px;border-radius:8px;overflow:auto}code{font-family:Consolas,monospace}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px 10px}img{max-width:100%}blockquote{border-left:3px solid #9ad6ce;margin:0;padding:2px 14px;color:#555}</style>\n</head>\n<body>\n${inner}\n</body>\n</html>`

/* ─────────────────────────── Markdown → docx ─────────────────────────── */

async function markdownToDocx(md: string): Promise<Blob> {
  const { Document, Packer, Paragraph, HeadingLevel, TextRun } = await import('docx')
  type ParagraphChild = ConstructorParameters<typeof Paragraph>[0] extends infer O
    ? O extends { children?: infer C }
      ? NonNullable<C> extends readonly (infer T)[]
        ? T
        : never
      : never
    : never

  function inlineRuns(text: string, extra: Record<string, unknown> = {}): ParagraphChild[] {
    // 简单解析 **粗体** *斜体* `代码`
    const runs: ParagraphChild[] = []
    const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g
    let last = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text))) {
      if (m.index > last) runs.push(new TextRun({ text: text.slice(last, m.index), ...extra }))
      const tok = m[0]
      if (tok.startsWith('**')) runs.push(new TextRun({ text: tok.slice(2, -2), bold: true, ...extra }))
      else if (tok.startsWith('`')) runs.push(new TextRun({ text: tok.slice(1, -1), font: 'Courier New', ...extra }))
      else runs.push(new TextRun({ text: tok.slice(1, -1), italics: true, ...extra }))
      last = m.index + tok.length
    }
    if (last < text.length) runs.push(new TextRun({ text: text.slice(last), ...extra }))
    return runs
  }

  const children: InstanceType<typeof Paragraph>[] = []
  const lines = md.split(/\r?\n/)
  let inCode = false
  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      inCode = !inCode
      continue
    }
    if (inCode) {
      children.push(new Paragraph({ children: [new TextRun({ text: line, font: 'Courier New', size: 20 })] }))
      continue
    }
    const h = line.match(/^(#{1,6})\s+(.*)/)
    if (h) {
      const levels = [
        HeadingLevel.HEADING_1,
        HeadingLevel.HEADING_2,
        HeadingLevel.HEADING_3,
        HeadingLevel.HEADING_4,
        HeadingLevel.HEADING_5,
        HeadingLevel.HEADING_6,
      ]
      children.push(new Paragraph({ heading: levels[h[1].length - 1], children: inlineRuns(h[2]) }))
      continue
    }
    if (/^\s*([-*+])\s+/.test(line)) {
      children.push(
        new Paragraph({ bullet: { level: 0 }, children: inlineRuns(line.replace(/^\s*[-*+]\s+/, '')) }),
      )
      continue
    }
    if (/^\s*>\s?/.test(line)) {
      children.push(
        new Paragraph({
          indent: { left: 480 },
          children: inlineRuns(line.replace(/^\s*>\s?/, ''), { italics: true, color: '555555' }),
        }),
      )
      continue
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: '' })],
          border: { bottom: { style: 'single', size: 6, color: 'BBBBBB' } },
        }),
      )
      continue
    }
    if (!line.trim()) continue
    children.push(new Paragraph({ children: inlineRuns(line) }))
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Roboto', size: 22 } } } },
    sections: [{ children }],
  })
  const buf = await Packer.toBuffer(doc)
  return new Blob([buf as unknown as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}

/* ─────────────────────────── HTML → PDF（栅格化，通用管线） ─────────────────────────── */

/** html2pdf 的统一配置：克隆文档内重写 oklch（其解析器不支持），返回A4 栅格化 worker 配置 */
function pdfStageHtml2CanvasOptions() {
  return {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    onclone: (doc: Document) => {
      doc.querySelectorAll('style').forEach((s) => {
        if (s.textContent?.includes('oklch')) {
          s.textContent = s.textContent.replace(/oklch\([^()]*\)/g, '#8a8a8a')
        }
      })
      try {
        for (const sheet of [...doc.styleSheets]) {
          if (sheet.ownerNode instanceof HTMLStyleElement) continue
          const rules = [...sheet.cssRules].map((r) => r.cssText).join('\n')
          const st = doc.createElement('style')
          st.textContent = rules.replace(/oklch\([^()]*\)/g, '#8a8a8a')
          doc.head.appendChild(st)
        }
      } catch {
        /* 跨源样式表跳过 */
      }
      const st = doc.createElement('style')
      st.textContent = `html,body,#root{background:#ffffff !important;color:#111111 !important;
        border-color:#e2e2e2 !important;outline-color:#e2e2e2 !important;}
        .docx-pdf-stage *,.docx-pdf-stage *::before,.docx-pdf-stage *::after{
          border-color:#e2e2e2 !important;outline-color:#e2e2e2 !important;
          box-shadow:none !important;text-shadow:none !important;
        }`
      doc.head.appendChild(st)
    },
  }
}

/** 把 HTML 片段排版并栅格化为 PDF Blob */
async function rasterizeHtmlToPdf(innerHtml: string, onProgress: (p: number) => void): Promise<Blob> {
  const mod = await import('html2pdf.js')
  const html2pdf = (mod as unknown as { default: typeof mod.default }).default

  const host = document.createElement('div')
  host.style.cssText =
    'position:fixed;left:-10000px;top:0;width:794px;background:#ffffff;color:#111;z-index:-1;padding:32px 40px;'
  host.className = 'docx-pdf-stage docx-pdf-stage--html'
  host.innerHTML = innerHtml
  const style = document.createElement('style')
  style.textContent = `.docx-pdf-stage--html{font-family:'Roboto Variable','PingFang SC','Microsoft YaHei',sans-serif;line-height:1.75;font-size:14px}
    .docx-pdf-stage--html h1,.docx-pdf-stage--html h2,.docx-pdf-stage--html h3{line-height:1.35;margin:1em 0 .4em}
    .docx-pdf-stage--html pre{background:#f4f6f6;padding:12px;border-radius:8px;overflow:hidden;white-space:pre-wrap}
    .docx-pdf-stage--html code{font-family:Consolas,monospace}
    .docx-pdf-stage--html table{border-collapse:collapse;width:100%}
    .docx-pdf-stage--html td,.docx-pdf-stage--html th{border:1px solid #ccc;padding:6px 10px}
    .docx-pdf-stage--html img{max-width:100%}
    .docx-pdf-stage--html blockquote{border-left:3px solid #9ad6ce;margin:0;padding:2px 14px;color:#555}`
  document.head.appendChild(style)
  document.body.appendChild(host)
  try {
    await new Promise((r) => setTimeout(r, 120))
    onProgress(0.4)
    const worker = html2pdf()
      .set({
        margin: [10, 8, 10, 8],
        image: { type: 'jpeg', quality: 0.92 },
        html2canvas: pdfStageHtml2CanvasOptions(),
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] },
      })
      .from(host)
    const blob = (await worker.outputPdf('blob')) as Blob
    onProgress(1)
    return blob
  } finally {
    host.remove()
    style.remove()
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** docx → pdf：docx-preview 分页渲染 + html2pdf 栅格化 */
async function docxToPdf(file: File, onProgress: (p: number) => void): Promise<Blob> {
  const [{ renderAsync }, mod] = await Promise.all([import('docx-preview'), import('html2pdf.js')])
  const html2pdf = (mod as unknown as { default: typeof mod.default }).default

  const host = document.createElement('div')
  host.style.cssText =
    'position:fixed;left:-10000px;top:0;width:794px;background:#ffffff;color:#111;z-index:-1;'
  host.className = 'docx-pdf-stage'
  // html2canvas 不支持 oklch —— 容器内覆盖为十六进制颜色
  const style = document.createElement('style')
  style.textContent = `.docx-pdf-stage *,.docx-pdf-stage *::before,.docx-pdf-stage *::after{
    border-color:#e2e2e2 !important;
    outline-color:#e2e2e2 !important;
    box-shadow:none !important;
    text-shadow:none !important;
  }`
  document.head.appendChild(style)
  document.body.appendChild(host)
  try {
    await renderAsync(await file.arrayBuffer(), host, undefined, {
      inWrapper: true,
      ignoreLastRenderedPageBreak: false,
      useBase64URL: true,
    })
    // docx-preview 的分页容器每页 .docx-wrapper > section.docx
    // html2pdf 对整容器分页栅格化
    await new Promise((r) => setTimeout(r, 150))
    onProgress(0.4)
    const worker = html2pdf()
      .set({
        margin: [0, 0, 0, 0],
        image: { type: 'jpeg', quality: 0.92 },
        html2canvas: pdfStageHtml2CanvasOptions(),
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] },
      })
      .from((host.firstElementChild as HTMLElement | null) ?? host)
    const blob = (await worker.outputPdf('blob')) as Blob
    onProgress(1)
    return blob
  } finally {
    host.remove()
    style.remove()
  }
}

/* ─────────────────────────── 主转换器 ─────────────────────────── */

export const docsConvert: ConverterModule = {
  fields: [
    {
      key: 'target',
      label: '目标格式',
      type: 'select',
      default: '',
      options: (files) => {
        const opts = targetsFor(files)
        return opts.length ? opts : [{ value: '', label: '不支持的源格式' }]
      },
      hint: '选项随添加的文件格式自动变化（以第一个文件为准）',
    },
    {
      key: 'sheets',
      label: '工作表',
      type: 'select',
      default: 'first',
      options: [
        { value: 'first', label: '仅第一个工作表' },
        { value: 'all', label: '全部工作表（多文件输出）' },
      ],
      showIf: (s) => s.target === 'csv' || s.target === 'json',
    },
    {
      key: 'delimiter',
      label: 'CSV 分隔符',
      type: 'select',
      default: ',',
      options: [
        { value: ',', label: '逗号 ,' },
        { value: ';', label: '分号 ;' },
        { value: '\t', label: '制表符 Tab' },
      ],
      showIf: (s) => s.target === 'csv',
    },
  ],
  async run([file], s, ctx) {
    const srcExt = extOf(file.name)
    const target = String(s.target ?? '')
    if (!target) throw new Error('该源格式暂不支持，请查看支持列表')
    if (!TARGETS[srcExt]?.some((t) => t.value === target)) {
      throw new Error(`「${srcExt}」不能转换为「${target}」，请检查目标格式`)
    }
    const base = baseName(file.name)
    ctx.onProgress(0.3)

    // DOCX 源
    if (srcExt === 'docx') {
      if (target === 'pdf') {
        const blob = await docxToPdf(file, ctx.onProgress)
        return [{ name: `${base}.pdf`, blob }]
      }
      if (target === 'txt') {
        const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
        return [{ name: `${base}.txt`, blob: textBlob(value), preview: value.slice(0, 4000) }]
      }
      const { value: html } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() })
      if (target === 'html') {
        const full = HTML_SHELL(html)
        return [{ name: `${base}.html`, blob: textBlob(full, 'text/html'), preview: full.slice(0, 2000) }]
      }
      const md = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' }).turndown(html)
      return [{ name: `${base}.md`, blob: textBlob(md, 'text/markdown'), preview: md.slice(0, 4000) }]
    }

    // Markdown 源
    if (srcExt === 'md' || srcExt === 'markdown') {
      const md = await file.text()
      if (target === 'txt') return [{ name: `${base}.txt`, blob: textBlob(md), preview: md.slice(0, 4000) }]
      if (target === 'pdf') {
        const inner = await marked.parse(md)
        const blob = await rasterizeHtmlToPdf(inner, ctx.onProgress)
        return [{ name: `${base}.pdf`, blob }]
      }
      if (target === 'html') {
        const inner = await marked.parse(md)
        const full = HTML_SHELL(inner)
        return [{ name: `${base}.html`, blob: textBlob(full, 'text/html'), preview: full.slice(0, 2000) }]
      }
      const blob = await markdownToDocx(md)
      return [{ name: `${base}.docx`, blob }]
    }

    // HTML 源
    if (srcExt === 'html' || srcExt === 'htm') {
      const html = await file.text()
      const doc = new DOMParser().parseFromString(html, 'text/html')
      if (target === 'pdf') {
        const blob = await rasterizeHtmlToPdf(doc.body.innerHTML, ctx.onProgress)
        return [{ name: `${base}.pdf`, blob }]
      }
      if (target === 'md') {
        const md = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' }).turndown(
          doc.body.innerHTML,
        )
        return [{ name: `${base}.md`, blob: textBlob(md, 'text/markdown'), preview: md.slice(0, 4000) }]
      }
      const text = doc.body.innerText
      return [{ name: `${base}.txt`, blob: textBlob(text), preview: text.slice(0, 4000) }]
    }

    // TXT 源
    if (srcExt === 'txt') {
      const text = await file.text()
      if (target === 'pdf') {
        const inner = text
          .split(/\n{2,}/)
          .map((p) => `<p style="white-space:pre-wrap;margin:0 0 .8em">${escapeHtml(p)}</p>`)
          .join('')
        const blob = await rasterizeHtmlToPdf(inner, ctx.onProgress)
        return [{ name: `${base}.pdf`, blob }]
      }
      return [{ name: `${base}.md`, blob: textBlob(text, 'text/markdown'), preview: text.slice(0, 4000) }]
    }

    // PDF 源
    if (srcExt === 'pdf') {
      const doc = await loadPdf(file)
      const text = await extractPdfText(doc, ctx.onProgress)
      if (target === 'md') {
        const md = text
          .split(/\n{2,}/)
          .map((p) => p.replace(/\n/g, ' '))
          .join('\n\n')
        return [{ name: `${base}.md`, blob: textBlob(md, 'text/markdown'), preview: md.slice(0, 4000) }]
      }
      return [{ name: `${base}.txt`, blob: textBlob(text), preview: text.slice(0, 4000) }]
    }

    // 表格源
    if (srcExt === 'xlsx' || srcExt === 'xls') {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const sheetNames = s.sheets === 'all' ? wb.SheetNames : wb.SheetNames.slice(0, 1)
      if (!sheetNames.length) throw new Error('工作簿中没有工作表')
      if (target === 'csv') {
        const results: ResultFile[] = sheetNames.map((name) => {
          const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name], { FS: String(s.delimiter || ',') })
          return {
            name: sheetNames.length > 1 ? `${base}-${name}.csv` : `${base}.csv`,
            blob: textBlob(csv, 'text/csv'),
            preview: csv.slice(0, 3000),
          }
        })
        ctx.onProgress(1)
        return results
      }
      // json
      if (sheetNames.length === 1) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetNames[0]])
        const json = JSON.stringify(rows, null, 2)
        ctx.onProgress(1)
        return [{ name: `${base}.json`, blob: textBlob(json, 'application/json'), preview: json.slice(0, 4000) }]
      }
      const obj: Record<string, unknown[]> = {}
      for (const name of sheetNames) obj[name] = XLSX.utils.sheet_to_json(wb.Sheets[name])
      const json = JSON.stringify(obj, null, 2)
      ctx.onProgress(1)
      return [{ name: `${base}.json`, blob: textBlob(json, 'application/json'), preview: json.slice(0, 4000) }]
    }

    if (srcExt === 'csv') {
      const text = await file.text()
      const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true })
      if (target === 'json') {
        const json = JSON.stringify(parsed.data, null, 2)
        return [{ name: `${base}.json`, blob: textBlob(json, 'application/json'), preview: json.slice(0, 4000) }]
      }
      const ws = XLSX.utils.json_to_sheet(parsed.data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
      ctx.onProgress(1)
      return [{ name: `${base}.xlsx`, blob: new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) }]
    }

    if (srcExt === 'json') {
      const text = await file.text()
      let data: unknown
      try {
        data = JSON.parse(text)
      } catch {
        throw new Error('JSON 解析失败，请检查文件内容')
      }
      const rows = Array.isArray(data) ? data : [data]
      if (!rows.length || typeof rows[0] !== 'object' || rows[0] === null) {
        throw new Error('需要「对象数组」格式的 JSON（如 [{...},{...}]）')
      }
      if (target === 'csv') {
        const csv = Papa.unparse(rows as Record<string, unknown>[], { delimiter: String(s.delimiter || ',') })
        return [{ name: `${base}.csv`, blob: textBlob(csv, 'text/csv'), preview: csv.slice(0, 3000) }]
      }
      const ws = XLSX.utils.json_to_sheet(rows as Record<string, unknown>[])
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
      ctx.onProgress(1)
      return [{ name: `${base}.xlsx`, blob: new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) }]
    }

    throw new Error(`暂不支持「${srcExt}」格式`)
  },
}
