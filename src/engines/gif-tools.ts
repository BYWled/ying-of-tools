import { parseGIF, decompressFrames } from 'gifuct-js'
import { GIFEncoder, quantize, applyPalette } from 'gifenc'
import type { ConverterModule, ResultFile } from '@/config/types'
import { baseName } from '@/lib/utils'
import { decodeImage } from './image'

export interface GifFrame {
  /** 合成后的完整画布数据 */
  imageData: ImageData
  delay: number
}

/** 解析 GIF 并合成每帧完整画面（处理帧间增量与 disposal） */
export async function decodeGifFrames(file: File): Promise<{ frames: GifFrame[]; width: number; height: number }> {
  const buf = await file.arrayBuffer()
  const gif = parseGIF(buf as ArrayBuffer)
  const frames = decompressFrames(gif, true)
  if (!frames.length) throw new Error('GIF 中没有帧')

  const width = gif.lsd.width
  const height = gif.lsd.height
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!

  const out: GifFrame[] = []
  let saved: ImageData | null = null
  for (const frame of frames) {
    const { dims } = frame
    if (frame.disposalType === 3) {
      saved = ctx.getImageData(0, 0, width, height)
    }
    // 帧增量数据贴到完整画布
    if (dims.width > 0 && dims.height > 0) {
      const patch = new ImageData(new Uint8ClampedArray(frame.patch), dims.width, dims.height)
      // putImageData 不支持直接贴 ImageData 的部分区域，先画到临时画布
      const tmp = document.createElement('canvas')
      tmp.width = dims.width
      tmp.height = dims.height
      const tctx = tmp.getContext('2d')!
      tctx.putImageData(patch, 0, 0)
      ctx.drawImage(tmp, dims.left, dims.top)
    }
    out.push({
      imageData: ctx.getImageData(0, 0, width, height),
      delay: Math.max(10, frame.delay ?? 100),
    })
    if (frame.disposalType === 2) {
      ctx.clearRect(dims.left, dims.top, dims.width, dims.height)
    } else if (frame.disposalType === 3 && saved) {
      ctx.putImageData(saved, 0, 0)
      saved = null
    }
  }
  return { frames: out, width, height }
}

/* ─────────────────────────── GIF 拆帧 ─────────────────────────── */

export const gifSplit: ConverterModule = {
  fields: [],
  async run([file], _s, ctx) {
    const { frames, width, height } = await decodeGifFrames(file)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx2 = canvas.getContext('2d')!
    const base = baseName(file.name)
    const pad = String(frames.length).length

    const results: ResultFile[] = []
    for (let i = 0; i < frames.length; i++) {
      ctx2.putImageData(frames[i].imageData, 0, 0)
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('帧导出失败'))), 'image/png'),
      )
      results.push({ name: `${base}-${String(i + 1).padStart(pad, '0')}.png`, blob })
      ctx.onProgress((i + 1) / frames.length)
    }
    return results
  },
}

/* ─────────────────────────── 图片合成 GIF ─────────────────────────── */

export const gifCompose: ConverterModule = {
  mergeMode: true,
  fields: [
    { key: 'delay', label: '每帧停留', type: 'slider', default: 120, min: 20, max: 2000, step: 10, suffix: ' ms' },
    {
      key: 'loop',
      label: '循环次数',
      type: 'select',
      default: '0',
      options: [
        { value: '0', label: '无限循环' },
        { value: '1', label: '播放 1 次' },
        { value: '3', label: '播放 3 次' },
      ],
    },
    {
      key: 'maxSide',
      label: '尺寸限制',
      type: 'select',
      default: '640',
      options: [
        { value: '0', label: '按第一张图尺寸' },
        { value: '1280', label: '最长边 1280 px' },
        { value: '640', label: '最长边 640 px' },
        { value: '320', label: '最长边 320 px' },
      ],
    },
    {
      key: 'colors',
      label: '调色板颜色数',
      type: 'select',
      default: '256',
      options: [
        { value: '256', label: '256 色（最佳）' },
        { value: '128', label: '128 色' },
        { value: '64', label: '64 色（最小）' },
      ],
    },
  ],
  async run(files, s, ctx) {
    if (files.length < 2) throw new Error('请至少添加两张图片')
    const limit = Number(s.maxSide)

    // 统一尺寸：以第一张（或限制后）为准，居中放置
    const first = await decodeImage(files[0])
    let width = first.width
    let height = first.height
    if (limit > 0 && Math.max(width, height) > limit) {
      const ratio = limit / Math.max(width, height)
      width = Math.round(width * ratio)
      height = Math.round(height * ratio)
    }
    first.close()

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx2 = canvas.getContext('2d', { willReadFrequently: true })!

    const gif = GIFEncoder()
    const delay = Number(s.delay)
    const colors = Number(s.colors)

    for (let i = 0; i < files.length; i++) {
      const bitmap = await decodeImage(files[i])
      ctx2.fillStyle = '#ffffff'
      ctx2.fillRect(0, 0, width, height)
      const ratio = Math.min(width / bitmap.width, height / bitmap.height)
      const w = bitmap.width * ratio
      const h = bitmap.height * ratio
      ctx2.drawImage(bitmap, (width - w) / 2, (height - h) / 2, w, h)
      bitmap.close()

      const { data } = ctx2.getImageData(0, 0, width, height)
      const palette = quantize(data, colors)
      const index = applyPalette(data, palette)
      gif.writeFrame(index, width, height, {
        palette,
        delay,
        repeat: Number(s.loop),
        first: i === 0,
      })
      ctx.onProgress(((i + 1) / files.length) * 0.9)
    }
    gif.finish()
    ctx.onProgress(1)
    const blob = new Blob([gif.bytes() as unknown as BlobPart], { type: 'image/gif' })
    return [{ name: '合成动图.gif', blob }]
  },
}
