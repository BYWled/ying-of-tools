import { createWorker } from 'tesseract.js'
import { md5, sha1, sha256, sha384, sha512, crc32 } from 'hash-wasm'
import QRCode from 'qrcode'
import jsQR from 'jsqr'
import type { ConverterModule } from '@/config/types'
import { baseName, extOf } from '@/lib/utils'
import { loadPdf, renderPageToBlob } from './pdf'

/* ─────────────────────────── OCR ─────────────────────────── */

export const ocr: ConverterModule = {
  fields: [
    {
      key: 'lang',
      label: '识别语言',
      type: 'select',
      default: 'chi_sim+eng',
      options: [
        { value: 'chi_sim+eng', label: '简体中文 + 英文' },
        { value: 'chi_sim', label: '仅简体中文' },
        { value: 'eng', label: '仅英文' },
        { value: 'jpn', label: '日文' },
      ],
      hint: '语言包首次使用需联网下载并缓存在浏览器',
    },
  ],
  async run([file], s, ctx) {
    let blob: Blob = file
    // PDF 输入：逐页栅格化为图片再识别
    if (extOf(file.name) === 'pdf' || file.type === 'application/pdf') {
      const doc = await loadPdf(file)
      const pages: Blob[] = []
      for (let i = 1; i <= doc.numPages; i++) {
        const { blob: b } = await renderPageToBlob(doc, i, { dpi: 200, type: 'image/png' })
        pages.push(b)
      }
      blob = new Blob(pages, { type: 'image/png' })
    }

    const worker = await createWorker(String(s.lang), 1, { logger: () => {} })
    try {
      const { data } = await worker.recognize(blob)
      ctx.onProgress(1)
      const text = data.text.trim()
      if (!text) throw new Error('未识别到文字，请尝试更清晰的图片')
      return [{ name: `${baseName(file.name)}-识别.txt`, blob: new Blob([text], { type: 'text/plain;charset=utf-8' }), preview: text.slice(0, 4000) }]
    } finally {
      await worker.terminate()
    }
  },
}

/* ─────────────────────────── 二维码识别 ─────────────────────────── */

async function imageToImageData(blob: Blob): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

export const qrDecode: ConverterModule = {
  fields: [],
  async run([file], _s, ctx) {
    const imageData = await imageToImageData(file)
    ctx.onProgress(0.6)
    const result = jsQR(imageData.data, imageData.width, imageData.height)
    if (!result) throw new Error('未在图片中找到二维码，请尝试更清晰的图片')
    ctx.onProgress(1)
    return [
      {
        name: `${baseName(file.name)}-二维码.txt`,
        blob: new Blob([result.data], { type: 'text/plain;charset=utf-8' }),
        preview: result.data.slice(0, 4000),
      },
    ]
  },
}

/* ─────────────────────────── 字幕转换 ─────────────────────────── */

const SRT_TIME = /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/

function srtTimeToMs(t: string): number {
  const m = t.trim().match(SRT_TIME)
  if (!m) return 0
  return Number(m[1]) * 3600000 + Number(m[2]) * 60000 + Number(m[3]) * 1000 + Number(m[4])
}

function msToVttTime(ms: number): string {
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0')
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0')
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')
  const x = String(ms % 1000).padStart(3, '0')
  return `${h}:${m}:${s}.${x}`
}

type Cue = { start: number; end: number; text: string }

function parseSrt(content: string): Cue[] {
  const cues: Cue[] = []
  const blocks = content.replace(/\r\n/g, '\n').trim().split(/\n\n+/)
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim())
    const timeIdx = lines.findIndex((l) => l.includes('-->'))
    if (timeIdx < 0) continue
    const [a, b] = lines[timeIdx].split('-->')
    cues.push({ start: srtTimeToMs(a), end: srtTimeToMs(b), text: lines.slice(timeIdx + 1).join('\n') })
  }
  return cues
}

function parseVtt(content: string): Cue[] {
  const body = content.replace(/^WEBVTT.*\n/, '')
  return parseSrt(body)
}

function cuesToVtt(cues: Cue[]): string {
  return (
    'WEBVTT\n\n' +
    cues
      .map((c, i) => `${i + 1}\n${msToVttTime(c.start)} --> ${msToVttTime(c.end)}\n${c.text}`)
      .join('\n\n') +
    '\n'
  )
}

function cuesToSrt(cues: Cue[]): string {
  return (
    cues
      .map((c, i) => {
        const s = msToVttTime(c.start).replace('.', ',')
        const e = msToVttTime(c.end).replace('.', ',')
        return `${i + 1}\n${s} --> ${e}\n${c.text}`
      })
      .join('\n\n') + '\n'
  )
}

export const subtitleConvert: ConverterModule = {
  fields: [
    {
      key: 'target',
      label: '目标格式',
      type: 'select',
      default: 'vtt',
      options: [
        { value: 'vtt', label: 'WebVTT (.vtt)' },
        { value: 'srt', label: 'SubRip (.srt)' },
        { value: 'txt', label: '纯文本（只保留台词）' },
      ],
    },
  ],
  async run([file], s, ctx) {
    const content = await file.text()
    const ext = extOf(file.name)
    let cues: Cue[]
    if (ext === 'vtt' || content.trimStart().startsWith('WEBVTT')) cues = parseVtt(content)
    else cues = parseSrt(content)
    if (!cues.length) throw new Error('没有解析到字幕内容，请确认是 SRT 或 VTT 文件')
    ctx.onProgress(0.7)
    const base = baseName(file.name)
    if (s.target === 'txt') {
      const text = cues.map((c) => c.text).join('\n')
      ctx.onProgress(1)
      return [{ name: `${base}.txt`, blob: new Blob([text], { type: 'text/plain;charset=utf-8' }), preview: text.slice(0, 3000) }]
    }
    if (s.target === 'vtt') {
      const out = cuesToVtt(cues)
      ctx.onProgress(1)
      return [{ name: `${base}.vtt`, blob: new Blob([out], { type: 'text/vtt;charset=utf-8' }), preview: out.slice(0, 2000) }]
    }
    const out = cuesToSrt(cues)
    ctx.onProgress(1)
    return [{ name: `${base}.srt`, blob: new Blob([out], { type: 'text/plain;charset=utf-8' }), preview: out.slice(0, 2000) }]
  },
}

/* ─────────────────────────── 文件哈希 ─────────────────────────── */

export const fileHash: ConverterModule = {
  fields: [
    {
      key: 'algos',
      label: '哈希算法',
      type: 'select',
      default: 'all',
      options: [
        { value: 'all', label: 'MD5 + SHA 全家' },
        { value: 'md5', label: '仅 MD5' },
        { value: 'sha256', label: '仅 SHA-256' },
      ],
    },
  ],
  async run([file], s, ctx) {
    const buffer = await file.arrayBuffer()
    ctx.onProgress(0.3)
    const lines: string[] = [`文件：${file.name}`, `大小：${file.size} 字节`, '']
    const algos = String(s.algos)
    const bytes = new Uint8Array(buffer)
    if (algos === 'all' || algos === 'md5') lines.push(`MD5      ${await md5(bytes)}`)
    if (algos === 'all' || algos === 'sha256') lines.push(`SHA-256  ${await sha256(bytes)}`)
    if (algos === 'all') {
      lines.push(`SHA-1    ${await sha1(bytes)}`)
      lines.push(`SHA-384  ${await sha384(bytes)}`)
      lines.push(`SHA-512  ${await sha512(bytes)}`)
      lines.push(`CRC-32   ${await crc32(bytes)}`)
    }
    ctx.onProgress(1)
    const report = lines.join('\n')
    return [
      {
        name: `${baseName(file.name)}.hashes.txt`,
        blob: new Blob([report], { type: 'text/plain;charset=utf-8' }),
        preview: report,
      },
    ]
  },
}

/* ─────────────────────────── JSON 格式化 / 校验 ─────────────────────────── */

function sortKeysDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeysDeep)
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, val]) => [k, sortKeysDeep(val)]),
    )
  }
  return v
}

export const jsonFormat: ConverterModule = {
  fields: [
    {
      key: 'mode',
      label: '处理方式',
      type: 'select',
      default: 'pretty2',
      options: [
        { value: 'pretty2', label: '格式化（2 空格缩进）' },
        { value: 'pretty4', label: '格式化（4 空格缩进）' },
        { value: 'minify', label: '压缩为单行' },
        { value: 'validate', label: '仅校验（不修改）' },
      ],
    },
    { key: 'sortKeys', label: '按键名排序', type: 'toggle', default: false },
  ],
  async run([file], s, ctx) {
    const text = await file.text()
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch (e) {
      throw new Error(`JSON 解析失败：${e instanceof Error ? e.message : e}`)
    }
    ctx.onProgress(0.6)
    if (s.sortKeys) data = sortKeysDeep(data)
    const mode = String(s.mode)
    const out =
      mode === 'minify'
        ? JSON.stringify(data)
        : mode === 'pretty4'
          ? JSON.stringify(data, null, 4)
          : JSON.stringify(data, null, 2)
    ctx.onProgress(1)
    const note = mode === 'validate' ? '校验通过，格式未修改' : undefined
    return [
      {
        name: `${baseName(file.name)}.json`,
        blob: new Blob([out], { type: 'application/json;charset=utf-8' }),
        preview: (note ? note + '\n\n' : '') + out.slice(0, 4000),
      },
    ]
  },
}

/* ─────────────────────────── Favicon ICO 生成 ─────────────────────────── */

/** ICO 容器编码：内嵌 PNG（Vista+ 标准，浏览器全兼容） */
function encodeIco(sizes: { size: number; data: Uint8Array }[]): Blob {
  const count = sizes.length
  const header = new DataView(new ArrayBuffer(6 + count * 16))
  header.setUint16(0, 0, true) // reserved
  header.setUint16(2, 1, true) // type: icon
  header.setUint16(4, count, true)
  let offset = 6 + count * 16
  const parts: BlobPart[] = []
  sizes.forEach((p, i) => {
    const o = 6 + i * 16
    header.setUint8(o, p.size >= 256 ? 0 : p.size)
    header.setUint8(o + 1, p.size >= 256 ? 0 : p.size)
    header.setUint8(o + 2, 0) // 调色板色数
    header.setUint8(o + 3, 0) // reserved
    header.setUint16(o + 4, 1, true) // planes
    header.setUint16(o + 6, 32, true) // bpp
    header.setUint32(o + 8, p.data.length, true)
    header.setUint32(o + 12, offset, true)
    offset += p.data.length
    parts.push(p.data as unknown as BlobPart)
  })
  return new Blob([header.buffer, ...parts], { type: 'image/x-icon' })
}

export const faviconIco: ConverterModule = {
  fields: [
    {
      key: 'sizes',
      label: '包含尺寸',
      type: 'select',
      default: 'standard',
      options: [
        { value: 'standard', label: '标准（16 / 32 / 48 px）' },
        { value: 'full', label: '全尺寸（16 → 256 px）' },
        { value: 'simple', label: '极简（单尺寸 32 px）' },
      ],
      hint: '基于 PNG-in-ICO 格式，现代浏览器与 Windows 全兼容',
    },
  ],
  async run([file], s, ctx) {
    const { decodeImage } = await import('./image')
    const bitmap = await decodeImage(file)
    const sizeSet = String(s.sizes)
    const sizes =
      sizeSet === 'full'
        ? [16, 24, 32, 48, 64, 128, 256]
        : sizeSet === 'simple'
          ? [32]
          : [16, 32, 48]
    const canvas = document.createElement('canvas')
    const ctx2 = canvas.getContext('2d')!
    const pngs: { size: number; data: Uint8Array }[] = []
    for (let i = 0; i < sizes.length; i++) {
      const size = sizes[i]
      canvas.width = size
      canvas.height = size
      ctx2.imageSmoothingEnabled = true
      ctx2.imageSmoothingQuality = 'high'
      ctx2.clearRect(0, 0, size, size)
      ctx2.drawImage(bitmap, 0, 0, size, size)
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('尺寸渲染失败'))), 'image/png'),
      )
      pngs.push({ size, data: new Uint8Array(await blob.arrayBuffer()) })
      ctx.onProgress(((i + 1) / sizes.length) * 0.9)
    }
    bitmap.close()
    ctx.onProgress(1)
    return [{ name: 'favicon.ico', blob: encodeIco(pngs) }]
  },
}

/* ─────────────────────────── 二维码生成（供专属页调用） ─────────────────────────── */

export async function generateQrCanvas(text: string, opts: { width?: number; margin?: number; ecc?: 'L' | 'M' | 'Q' | 'H'; dark?: string; light?: string }) {
  return QRCode.toCanvas(document.createElement('canvas'), text, {
    width: opts.width ?? 512,
    margin: opts.margin ?? 2,
    errorCorrectionLevel: opts.ecc ?? 'M',
    color: { dark: opts.dark ?? '#0d1f1d', light: opts.light ?? '#ffffff' },
  })
}
