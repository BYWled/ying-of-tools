import { encode as mozjpegEncode } from '@jsquash/jpeg'
import { encode as webpEncode } from '@jsquash/webp'
import { encode as avifEncode } from '@jsquash/avif'
import { encode as jxlEncode, decode as jxlDecode } from '@jsquash/jxl'
import { optimise as oxipngOptimise } from '@jsquash/oxipng'
import { GIFEncoder, quantize, applyPalette } from 'gifenc'
import type { ConverterModule } from '@/config/types'
import { baseName } from '@/lib/utils'

/* ─────────────────────────── 解码 ─────────────────────────── */

function isHeic(file: File): boolean {
  return (
    ['image/heic', 'image/heif'].includes(file.type) || /\.(heic|heif)$/i.test(file.name)
  )
}

/** 解码任意图片（含 HEIC / JPEG XL，经 WASM）为 ImageBitmap */
export async function decodeImage(file: File): Promise<ImageBitmap> {
  if (isHeic(file)) {
    const { heicTo } = await import('heic-to')
    try {
      const jpeg = (await heicTo({ blob: file, type: 'image/jpeg', quality: 0.95 })) as Blob
      return await createImageBitmap(jpeg)
    } catch (e) {
      throw new Error(`HEIC 解码失败：${e instanceof Error ? e.message : e}`)
    }
  }
  // JPEG XL：浏览器普遍无法解码，走 WASM
  if (/\.jxl$/i.test(file.name) || file.type === 'image/jxl') {
    try {
      const imageData = await jxlDecode(await file.arrayBuffer())
      const canvas = document.createElement('canvas')
      canvas.width = imageData.width
      canvas.height = imageData.height
      canvas.getContext('2d')!.putImageData(imageData, 0, 0)
      return await createImageBitmap(canvas)
    } catch (e) {
      throw new Error(`JPEG XL 解码失败：${e instanceof Error ? e.message : e}`)
    }
  }
  try {
    return await createImageBitmap(file)
  } catch {
    // 兜底：<img> 解码
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return await createImageBitmap(img)
    } catch {
      throw new Error('无法解码该图片，文件可能已损坏或格式不受支持')
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

function bitmapToCanvas(bitmap: ImageBitmap, scale = 1, maxSize = 0): HTMLCanvasElement {
  let w = bitmap.width
  let h = bitmap.height
  if (maxSize > 0 && Math.max(w, h) > maxSize) {
    const ratio = maxSize / Math.max(w, h)
    w = Math.round(w * ratio)
    h = Math.round(h * ratio)
  }
  w = Math.max(1, Math.round(w * scale))
  h = Math.max(1, Math.round(h * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, w, h)
  return canvas
}

/* ─────────────────────────── 编码 ─────────────────────────── */

export type OutFormat = 'png' | 'jpeg' | 'webp' | 'avif' | 'jxl' | 'gif'

const EXT: Record<OutFormat, string> = { png: 'png', jpeg: 'jpg', webp: 'webp', avif: 'avif', jxl: 'jxl', gif: 'gif' }
const MIME: Record<OutFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
  jxl: 'image/jxl',
  gif: 'image/gif',
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b && b.size > 0 ? resolve(b) : reject(new Error(`浏览器不支持编码 ${type}`))),
      type,
      quality,
    ),
  )
}

/** 单帧 GIF 编码（静态图） */
function encodeGifFrame(canvas: HTMLCanvasElement): Blob {
  const ctx = canvas.getContext('2d')!
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const gif = GIFEncoder()
  const palette = quantize(data, 256)
  const index = applyPalette(data, palette)
  gif.writeFrame(index, canvas.width, canvas.height, { palette, delay: 0, repeat: 0, first: true })
  gif.finish()
  return new Blob([gif.bytes() as unknown as BlobPart], { type: MIME.gif })
}

/** 按目标格式编码；AVIF/JXL 走 jSquash，WebP 优先原生、失败回退 jSquash，GIF 为单帧静态 */
export async function encodeImage(
  canvas: HTMLCanvasElement,
  format: OutFormat,
  qualityPercent: number,
): Promise<Blob> {
  const q = Math.min(1, Math.max(0.05, qualityPercent / 100))
  if (format === 'png') return canvasToBlob(canvas, 'image/png')
  if (format === 'jpeg') return canvasToBlob(canvas, 'image/jpeg', q)
  if (format === 'gif') return encodeGifFrame(canvas)
  if (format === 'webp') {
    try {
      return await canvasToBlob(canvas, 'image/webp', q)
    } catch {
      const data = await webpEncode(canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height), {
        quality: qualityPercent,
      })
      return new Blob([data], { type: MIME.webp })
    }
  }
  if (format === 'jxl') {
    const data = await jxlEncode(
      canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height),
      { quality: Math.round(qualityPercent), effort: 5 } as Parameters<typeof jxlEncode>[1],
    )
    return new Blob([data], { type: MIME.jxl })
  }
  // AVIF：浏览器原生无法编码，使用 jSquash（libaom）。
  // cqLevel 取值 0-63，越小质量越高。
  const data = await avifEncode(
    canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height),
    {
      cqLevel: Math.round((100 - qualityPercent) * 0.6),
      denoiseLevel: 0,
      cqAlphaLevel: 0,
      tileRowsLog2: 0,
      tileColsLog2: 0,
      speed: 6,
      subsample: 1,
      chromaDeltaQ: false,
      sharpness: 0,
      tune: 0,
    } as Parameters<typeof avifEncode>[1],
  )
  return new Blob([data], { type: MIME.avif })
}

const FIELDS_FORMAT = {
  key: 'format',
  label: '输出格式',
  type: 'select' as const,
  default: 'webp',
  options: [
    { value: 'webp', label: 'WebP · 通用高压缩' },
    { value: 'jpeg', label: 'JPG · 兼容性最好' },
    { value: 'png', label: 'PNG · 无损透明' },
    { value: 'avif', label: 'AVIF · 极限压缩（较慢）' },
    { value: 'jxl', label: 'JPEG XL · 新一代压缩' },
    { value: 'gif', label: 'GIF · 单帧静态图' },
  ],
}

/* ─────────────────────────── 图片格式转换 ─────────────────────────── */

export const imageConvert: ConverterModule = {
  fields: [
    FIELDS_FORMAT,
    {
      key: 'quality',
      label: '质量',
      type: 'slider',
      default: 85,
      min: 10,
      max: 100,
      suffix: '%',
      showIf: (s) => s.format !== 'png',
    },
    {
      key: 'maxSize',
      label: '最长边缩放',
      type: 'select',
      default: '0',
      options: [
        { value: '0', label: '保持原始尺寸' },
        { value: '4096', label: '缩至 4096 px' },
        { value: '2048', label: '缩至 2048 px' },
        { value: '1080', label: '缩至 1080 px' },
        { value: '640', label: '缩至 640 px' },
      ],
    },
  ],
  async run([file], s, ctx) {
    const bitmap = await decodeImage(file)
    const canvas = bitmapToCanvas(bitmap, 1, Number(s.maxSize))
    bitmap.close()
    ctx.onProgress(0.7)
    const blob = await encodeImage(canvas, s.format as OutFormat, Number(s.quality))
    ctx.onProgress(1)
    return [{ name: `${baseName(file.name)}.${EXT[s.format as OutFormat]}`, blob }]
  },
}

/* ─────────────────────────── 图片压缩 ─────────────────────────── */

export const imageCompress: ConverterModule = {
  fields: [
    {
      key: 'engine',
      label: '压缩引擎',
      type: 'select',
      default: 'auto',
      options: [
        { value: 'auto', label: '自动（按源格式选择）' },
        { value: 'mozjpeg', label: 'MozJPEG → JPG' },
        { value: 'oxipng', label: 'OxiPNG → PNG（无损优化）' },
        { value: 'webp', label: 'libwebp → WebP' },
        { value: 'avif', label: 'AVIF（较慢）' },
      ],
      hint: '均来自 Squoosh 同款 WASM 编解码器',
    },
    {
      key: 'quality',
      label: '质量',
      type: 'slider',
      default: 75,
      min: 10,
      max: 100,
      suffix: '%',
      showIf: (s) => s.engine !== 'oxipng',
    },
    {
      key: 'maxSize',
      label: '最长边缩放',
      type: 'select',
      default: '0',
      options: [
        { value: '0', label: '保持原始尺寸' },
        { value: '4096', label: '缩至 4096 px' },
        { value: '2048', label: '缩至 2048 px' },
        { value: '1080', label: '缩至 1080 px' },
      ],
      showIf: (s) => s.engine !== 'oxipng',
    },
  ],
  async run([file], s, ctx) {
    let engine = String(s.engine)
    if (engine === 'auto') {
      engine = /\.png$/i.test(file.name) || file.type === 'image/png' ? 'oxipng' : 'mozjpeg'
    }

    const suffixMap: Record<string, [string, string]> = {
      mozjpeg: ['jpg', 'image/jpeg'],
      oxipng: ['png', 'image/png'],
      webp: ['webp', 'image/webp'],
      avif: ['avif', 'image/avif'],
    }
    const [ext, mime] = suffixMap[engine]
    const base = baseName(file.name)

    if (engine === 'oxipng') {
      const bitmap = await decodeImage(file)
      const canvas = bitmapToCanvas(bitmap)
      bitmap.close()
      const rawPng = await canvasToBlob(canvas, 'image/png')
      const optimized = await oxipngOptimise(await rawPng.arrayBuffer(), { level: 3 })
      ctx.onProgress(1)
      return [{ name: `${base}-优化.png`, blob: new Blob([optimized], { type: mime }) }]
    }

    const bitmap = await decodeImage(file)
    const canvas = bitmapToCanvas(bitmap, 1, Number(s.maxSize))
    bitmap.close()
    ctx.onProgress(0.6)
    let blob: Blob
    if (engine === 'mozjpeg') {
      const data = await mozjpegEncode(
        canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height),
        { quality: Number(s.quality) },
      )
      blob = new Blob([data], { type: mime })
    } else if (engine === 'webp') {
      const data = await webpEncode(
        canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height),
        { quality: Number(s.quality) },
      )
      blob = new Blob([data], { type: mime })
    } else {
      blob = await encodeImage(canvas, 'avif', Number(s.quality))
    }
    ctx.onProgress(1)
    return [{ name: `${base}-压缩.${ext}`, blob }]
  },
}

/* ─────────────────────────── HEIC 转换 ─────────────────────────── */

export const heicConvert: ConverterModule = {
  fields: [
    {
      key: 'format',
      label: '输出格式',
      type: 'select',
      default: 'jpeg',
      options: [
        { value: 'jpeg', label: 'JPG' },
        { value: 'png', label: 'PNG' },
      ],
    },
    {
      key: 'quality',
      label: '质量',
      type: 'slider',
      default: 92,
      min: 10,
      max: 100,
      suffix: '%',
      showIf: (s) => s.format === 'jpeg',
    },
  ],
  async run([file], s, ctx) {
    const bitmap = await decodeImage(file)
    const canvas = bitmapToCanvas(bitmap)
    bitmap.close()
    ctx.onProgress(0.7)
    const format = (s.format === 'png' ? 'png' : 'jpeg') as OutFormat
    const blob = await encodeImage(canvas, format, Number(s.quality))
    ctx.onProgress(1)
    return [{ name: `${baseName(file.name)}.${EXT[format]}`, blob }]
  },
}

/* ─────────────────────────── 批量调整尺寸 ─────────────────────────── */

export const imageResize: ConverterModule = {
  fields: [
    {
      key: 'mode',
      label: '缩放方式',
      type: 'select',
      default: 'percent',
      options: [
        { value: 'percent', label: '按百分比' },
        { value: 'width', label: '指定宽度（等比）' },
        { value: 'height', label: '指定高度（等比）' },
        { value: 'maxside', label: '限制最长边' },
      ],
    },
    { key: 'value', label: '数值', type: 'text', default: '50', placeholder: '百分比或像素值' },
    {
      key: 'format',
      label: '输出格式',
      type: 'select',
      default: 'keep',
      options: [
        { value: 'keep', label: '保持原格式（PNG/JPG/WebP）' },
        { value: 'png', label: 'PNG' },
        { value: 'jpeg', label: 'JPG' },
        { value: 'webp', label: 'WebP' },
      ],
    },
    {
      key: 'quality',
      label: '质量',
      type: 'slider',
      default: 90,
      min: 10,
      max: 100,
      suffix: '%',
      showIf: (s) => s.format !== 'keep' && s.format !== 'png',
    },
  ],
  async run([file], s, ctx) {
    const bitmap = await decodeImage(file)
    const v = Number(String(s.value).trim())
    if (!Number.isFinite(v) || v <= 0) throw new Error('请输入有效的数值')
    let scale = 1
    const mode = String(s.mode)
    if (mode === 'percent') scale = v / 100
    else if (mode === 'width') scale = v / bitmap.width
    else if (mode === 'height') scale = v / bitmap.height
    else if (mode === 'maxside') scale = Math.min(1, v / Math.max(bitmap.width, bitmap.height))
    if (scale <= 0) throw new Error('缩放比例无效')

    const canvas = bitmapToCanvas(bitmap, scale)
    const format =
      s.format === 'keep'
        ? (['png', 'jpeg', 'webp'].includes(file.type.replace('image/', ''))
            ? (file.type.replace('image/', '') as OutFormat)
            : 'png')
        : (s.format as OutFormat)
    bitmap.close()
    ctx.onProgress(0.7)
    const blob = await encodeImage(canvas, format, Number(s.quality))
    ctx.onProgress(1)
    const keepExt = file.name.split('.').pop()?.toLowerCase() ?? 'png'
    const ext = s.format === 'keep' ? (keepExt === 'jpeg' ? 'jpg' : keepExt) : EXT[format]
    return [{ name: `${baseName(file.name)}-缩放.${ext}`, blob }]
  },
}

/* ─────────────────────────── 图片加水印 ─────────────────────────── */

const POSITIONS: Record<string, [number, number, CanvasTextAlign, CanvasTextBaseline]> = {
  tile: [0.5, 0.5, 'center', 'middle'],
  tl: [0.04, 0.06, 'left', 'top'],
  tc: [0.5, 0.06, 'center', 'top'],
  tr: [0.96, 0.06, 'right', 'top'],
  cl: [0.04, 0.5, 'left', 'middle'],
  center: [0.5, 0.5, 'center', 'middle'],
  cr: [0.96, 0.5, 'right', 'middle'],
  bl: [0.04, 0.94, 'left', 'bottom'],
  bc: [0.5, 0.94, 'center', 'bottom'],
  br: [0.96, 0.94, 'right', 'bottom'],
}

export const imageWatermark: ConverterModule = {
  fields: [
    { key: 'text', label: '水印文字', type: 'text', default: '伴莺的工具箱', placeholder: '支持中文' },
    {
      key: 'position',
      label: '位置',
      type: 'select',
      default: 'br',
      options: [
        { value: 'br', label: '右下' },
        { value: 'bc', label: '底部居中' },
        { value: 'bl', label: '左下' },
        { value: 'cr', label: '右侧居中' },
        { value: 'center', label: '正中' },
        { value: 'cl', label: '左侧居中' },
        { value: 'tr', label: '右上' },
        { value: 'tc', label: '顶部居中' },
        { value: 'tl', label: '左上' },
        { value: 'tile', label: '平铺全图' },
      ],
    },
    { key: 'fontSize', label: '字号', type: 'slider', default: 48, min: 12, max: 200 },
    { key: 'opacity', label: '不透明度', type: 'slider', default: 25, min: 5, max: 100, suffix: '%' },
    {
      key: 'color',
      label: '颜色',
      type: 'select',
      default: 'white',
      options: [
        { value: 'white', label: '白色' },
        { value: 'black', label: '黑色' },
        { value: 'teal', label: '青绿' },
      ],
    },
  ],
  async run([file], s, ctx) {
    const bitmap = await decodeImage(file)
    const canvas = bitmapToCanvas(bitmap)
    bitmap.close()
    const ctx2 = canvas.getContext('2d')!
    const colorMap: Record<string, string> = {
      white: '#ffffff',
      black: '#000000',
      teal: '#1f8e83',
    }
    ctx2.globalAlpha = Number(s.opacity) / 100
    ctx2.fillStyle = colorMap[String(s.color)] ?? '#ffffff'
    ctx2.font = `600 ${Number(s.fontSize)}px 'Roboto Variable', 'Microsoft YaHei', sans-serif`
    const pos = POSITIONS[String(s.position)] ?? POSITIONS.br
    if (String(s.position) === 'tile') {
      const tw = ctx2.measureText(String(s.text)).width
      const stepX = Math.max(tw * 1.8, 200)
      const stepY = Math.max(Number(s.fontSize) * 5, 140)
      let row = 0
      for (let y = stepY / 2; y < canvas.height + stepY; y += stepY, row++) {
        for (let x = -stepX / 2; x < canvas.width + stepX; x += stepX) {
          ctx2.fillText(String(s.text || ''), x + (row % 2 ? stepX / 2 : 0), y)
        }
      }
    } else {
      ctx2.textAlign = pos[2]
      ctx2.textBaseline = pos[3]
      ctx2.fillText(String(s.text || ''), canvas.width * pos[0], canvas.height * pos[1])
    }

    ctx.onProgress(0.7)
    const keepType = ['png', 'jpeg', 'webp'].includes(file.type.replace('image/', '')) ? file.type : 'image/png'
    const ext = keepType === 'image/webp' ? 'webp' : keepType === 'image/png' ? 'png' : 'jpg'
    const blob = await canvasToBlob(canvas, keepType, 0.92)
    ctx.onProgress(1)
    return [{ name: `${baseName(file.name)}-水印.${ext}`, blob }]
  },
}
