import { fetchFile } from '@ffmpeg/util'
import type { ConverterModule, Settings } from '@/config/types'
import { baseName, extOf } from '@/lib/utils'
import { runFFmpeg, useFfmpeg } from './ffmpeg'

const AUDIO_MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  flac: 'audio/flac',
  opus: 'audio/opus',
}

function isLossy(f: string) {
  return f !== 'wav' && f !== 'flac'
}

/** 拼装音频编码参数（公共部分） */
function audioArgs(format: string, s: Settings): string[] {
  const args: string[] = []
  const sr = String(s.sampleRate ?? 'keep')
  if (sr !== 'keep') args.push('-ar', sr)
  switch (format) {
    case 'mp3':
      return [...args, '-c:a', 'libmp3lame', '-b:a', `${s.bitrate}k`]
    case 'ogg':
      return [...args, '-c:a', 'libvorbis', '-b:a', `${s.bitrate}k`]
    case 'opus':
      return [...args, '-c:a', 'libopus', '-b:a', `${Math.min(Number(s.bitrate) * 2, 512)}k`]
    case 'm4a':
      return [...args, '-c:a', 'aac', '-b:a', `${s.bitrate}k`]
    case 'flac':
      return [...args, '-c:a', 'flac']
    case 'wav':
      return [...args, '-c:a', 'pcm_s16le']
    default:
      throw new Error(`不支持的音频格式：${format}`)
  }
}

function seekArgs(s: { start?: unknown; end?: unknown }): string[] {
  const start = String(s.start ?? '').trim()
  const end = String(s.end ?? '').trim()
  const args: string[] = []
  if (start) args.push('-ss', start)
  if (end) {
    if (start) {
      const toSec = (t: string) => t.split(':').reduce((acc, p) => acc * 60 + parseFloat(p || '0'), 0)
      const dur = Math.max(0.01, toSec(end) - toSec(start))
      args.push('-t', String(dur))
    } else {
      args.push('-t', end)
    }
  }
  return args
}

/* ─────────────────────────── 音频转换 ─────────────────────────── */

export const audioConvert: ConverterModule = {
  fields: [
    {
      key: 'format',
      label: '输出格式',
      type: 'select',
      default: 'mp3',
      options: [
        { value: 'mp3', label: 'MP3' },
        { value: 'wav', label: 'WAV（无损）' },
        { value: 'ogg', label: 'OGG Vorbis' },
        { value: 'm4a', label: 'M4A / AAC' },
        { value: 'flac', label: 'FLAC（无损）' },
        { value: 'opus', label: 'Opus' },
      ],
    },
    { key: 'bitrate', label: '码率', type: 'slider', default: 192, min: 64, max: 320, step: 32, suffix: ' kbps', showIf: (s) => isLossy(String(s.format)) },
    {
      key: 'sampleRate',
      label: '采样率',
      type: 'select',
      default: 'keep',
      options: [
        { value: 'keep', label: '保持原始' },
        { value: '48000', label: '48000 Hz' },
        { value: '44100', label: '44100 Hz' },
        { value: '22050', label: '22050 Hz' },
      ],
    },
  ],
  async run([file], s, ctx) {
    const format = String(s.format)
    const inName = `in.${extOf(file.name) || 'bin'}`
    const outName = `out.${format}`
    const args = [...seekArgs(s), '-i', inName, '-vn', ...audioArgs(format, s), '-y', outName]
    const blob = await runFFmpeg(file, inName, outName, args, ctx.onProgress, AUDIO_MIME[format])
    return [{ name: `${baseName(file.name)}.${format}`, blob }]
  },
}

/* ─────────────────────────── 视频转换 ─────────────────────────── */

function scaleFilter(s: Settings): string[] {
  const h = String(s.resolution ?? 'keep')
  if (h === 'keep') return []
  return ['-vf', `scale=-2:${h}`]
}

function fpsArgs(s: Settings): string[] {
  const fps = String(s.fps ?? 'keep')
  return fps === 'keep' ? [] : ['-r', fps]
}

export const videoConvert: ConverterModule = {
  fields: [
    {
      key: 'format',
      label: '输出格式',
      type: 'select',
      default: 'mp4',
      options: [
        { value: 'mp4', label: 'MP4 · H.264 + AAC' },
        { value: 'webm', label: 'WebM · VP8 + Vorbis' },
      ],
    },
    {
      key: 'quality',
      label: '画质',
      type: 'select',
      default: '28',
      options: [
        { value: '23', label: '高（文件较大）' },
        { value: '28', label: '均衡（推荐）' },
        { value: '33', label: '小（画质一般）' },
      ],
      hint: 'WASM 转码速度有限，长视频请耐心等待',
    },
    {
      key: 'resolution',
      label: '分辨率（高度）',
      type: 'select',
      default: 'keep',
      options: [
        { value: 'keep', label: '保持原始' },
        { value: '1080', label: '1080p' },
        { value: '720', label: '720p' },
        { value: '480', label: '480p' },
      ],
    },
    {
      key: 'fps',
      label: '帧率',
      type: 'select',
      default: 'keep',
      options: [
        { value: 'keep', label: '保持原始' },
        { value: '30', label: '30 fps' },
        { value: '24', label: '24 fps' },
        { value: '15', label: '15 fps' },
      ],
    },
  ],
  async run([file], s, ctx) {
    const format = String(s.format)
    const inName = `in.${extOf(file.name) || 'bin'}`
    const outName = `out.${format}`
    let args: string[]
    if (format === 'mp4') {
      args = ['-i', inName, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(s.quality), '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart']
    } else {
      args = ['-i', inName, '-c:v', 'libvpx', '-b:v', '1200k', '-c:a', 'libvorbis']
    }
    args = [...args, ...scaleFilter(s), ...fpsArgs(s), '-y', outName]
    const blob = await runFFmpeg(
      file,
      inName,
      outName,
      args,
      ctx.onProgress,
      format === 'mp4' ? 'video/mp4' : 'video/webm',
    )
    return [{ name: `${baseName(file.name)}.${format}`, blob }]
  },
}

/* ─────────────────────────── 视频转 GIF（两遍调色板） ─────────────────────────── */

export const videoToGif: ConverterModule = {
  fields: [
    { key: 'fps', label: '帧率', type: 'slider', default: 12, min: 5, max: 30 },
    { key: 'width', label: '宽度', type: 'slider', default: 480, min: 160, max: 1280, step: 20, suffix: ' px' },
    { key: 'start', label: '开始时间（秒）', type: 'text', default: '0', placeholder: '如 0 或 12.5' },
    { key: 'end', label: '结束时间（秒）', type: 'text', default: '', placeholder: '留空表示到结尾' },
  ],
  async run([file], s, ctx) {
    const ff = await useFfmpeg.getState().load()
    const inName = `in.${extOf(file.name) || 'bin'}`
    await ff.writeFile(inName, await fetchFile(file))

    const seek = seekArgs(s)
    const fps = Number(s.fps)
    const w = Number(s.width)
    const vf = `fps=${fps},scale=${w}:-2:flags=lanczos`

    const onProg = (p: number) => ctx.onProgress(p)
    const handler = ({ progress }: { progress: number }) => onProg(Math.max(0, Math.min(1, progress * 0.5)))
    ff.on('progress', handler)
    try {
      // 第一遍：生成调色板
      const code1 = await ff.exec([...seek, '-i', inName, '-vf', `${vf},palettegen=stats_mode=diff`, '-y', 'palette.png'])
      if (code1 !== 0) throw new Error('生成调色板失败（检查时间范围是否有效）')
      // 第二遍：应用调色板
      const code2 = await ff.exec([
        ...seek,
        '-i', inName,
        '-i', 'palette.png',
        '-lavfi', `${vf} [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=4`,
        '-y', 'out.gif',
      ])
      if (code2 !== 0) throw new Error('GIF 编码失败')
      const data = await ff.readFile('out.gif')
      if (!(data instanceof Uint8Array) || data.length === 0) throw new Error('输出为空')
      ctx.onProgress(1)
      const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
      return [{ name: `${baseName(file.name)}.gif`, blob: new Blob([buf], { type: 'image/gif' }) }]
    } finally {
      ff.off('progress', handler)
      for (const f of [inName, 'palette.png', 'out.gif']) {
        try {
          await ff.deleteFile(f)
        } catch {
          /* 忽略 */
        }
      }
    }
  },
}

/* ─────────────────────────── 视频裁剪 ─────────────────────────── */

export const videoTrim: ConverterModule = {
  fields: [
    { key: 'start', label: '开始时间', type: 'text', default: '0', placeholder: '秒或 00:01:30' },
    { key: 'end', label: '结束时间', type: 'text', default: '', placeholder: '留空表示到结尾' },
    {
      key: 'mode',
      label: '模式',
      type: 'select',
      default: 'copy',
      options: [
        { value: 'copy', label: '流复制（极快，关键帧对齐）' },
        { value: 'encode', label: '重新编码（精确到秒，较慢）' },
      ],
    },
  ],
  async run([file], s, ctx) {
    const ext = extOf(file.name) || 'mp4'
    const inName = `in.${ext}`
    const outName = `out.${ext}`
    const seek = seekArgs(s)
    const codec = s.mode === 'copy' ? ['-c', 'copy'] : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-c:a', 'aac', '-b:a', '128k', '-pix_fmt', 'yuv420p']
    const args = [...seek, '-i', inName, ...codec, '-y', outName]
    const mime = ext === 'webm' ? 'video/webm' : 'video/mp4'
    const blob = await runFFmpeg(file, inName, outName, args, ctx.onProgress, mime)
    return [{ name: `${baseName(file.name)}-裁剪.${ext}`, blob }]
  },
}

/* ─────────────────────────── 提取音频 ─────────────────────────── */

export const extractAudio: ConverterModule = {
  fields: [
    {
      key: 'format',
      label: '输出格式',
      type: 'select',
      default: 'mp3',
      options: [
        { value: 'mp3', label: 'MP3' },
        { value: 'wav', label: 'WAV（无损）' },
        { value: 'm4a', label: 'M4A / AAC' },
        { value: 'flac', label: 'FLAC（无损）' },
        { value: 'ogg', label: 'OGG Vorbis' },
      ],
    },
    { key: 'bitrate', label: '码率', type: 'slider', default: 192, min: 64, max: 320, step: 32, suffix: ' kbps', showIf: (s) => isLossy(String(s.format)) },
  ],
  async run([file], s, ctx) {
    const format = String(s.format)
    const inName = `in.${extOf(file.name) || 'bin'}`
    const outName = `out.${format}`
    const args = ['-i', inName, '-vn', ...audioArgs(format, s), '-y', outName]
    const blob = await runFFmpeg(file, inName, outName, args, ctx.onProgress, AUDIO_MIME[format])
    return [{ name: `${baseName(file.name)}.${format}`, blob }]
  },
}

/* ─────────────────────────── 音频裁剪 ─────────────────────────── */

export const audioTrim: ConverterModule = {
  fields: [
    { key: 'start', label: '开始时间', type: 'text', default: '0', placeholder: '秒或 00:01:30' },
    { key: 'end', label: '结束时间', type: 'text', default: '', placeholder: '留空表示到结尾' },
    {
      key: 'format',
      label: '输出格式',
      type: 'select',
      default: 'keep',
      options: [
        { value: 'keep', label: '保持原格式' },
        { value: 'mp3', label: 'MP3' },
        { value: 'wav', label: 'WAV' },
        { value: 'm4a', label: 'M4A' },
        { value: 'flac', label: 'FLAC' },
      ],
    },
    { key: 'bitrate', label: '码率', type: 'slider', default: 192, min: 64, max: 320, step: 32, suffix: ' kbps', showIf: (s) => s.format !== 'keep' && s.format !== 'wav' && s.format !== 'flac' },
  ],
  async run([file], s, ctx) {
    const format = String(s.format) === 'keep' ? extOf(file.name) || 'mp3' : String(s.format)
    const inName = `in.${extOf(file.name) || 'bin'}`
    const outName = `out.${format}`
    const args = [...seekArgs(s), '-i', inName, ...audioArgs(format, s), '-y', outName]
    const blob = await runFFmpeg(file, inName, outName, args, ctx.onProgress, AUDIO_MIME[format])
    return [{ name: `${baseName(file.name)}-裁剪.${format}`, blob }]
  },
}
