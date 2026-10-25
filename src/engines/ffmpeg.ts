import { FFmpeg } from '@ffmpeg/ffmpeg'
import { create } from 'zustand'
// 由 Vite 打包的 worker（scripts/copy-ffmpeg.mjs 生成到 src/vendor，解析其相对导入）
import ffmpegWorkerUrl from '@/vendor/ffmpeg-worker/worker.js?worker&url'
import { bytesToBlobUrl, loadEngineBytes, npmFileUrls } from './cdn'

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'error'

const CORE_VERSION = '0.12.10'

interface FfmpegState {
  status: EngineStatus
  /** 0~1 引擎下载进度 */
  progress: number
  /** 已接收 / 总字节（wasm 大文件时展示） */
  receivedMb: number
  totalMb: number
  /** 本次使用的下载源；命中持久缓存时为「本地缓存」 */
  source: string
  error?: string
  /** true = 使用多线程核心（页面处于跨源隔离状态） */
  mt: boolean
  load: () => Promise<FFmpeg>
  /** 加载失败后手动重试 */
  retry: () => Promise<FFmpeg>
}

let loadPromise: Promise<FFmpeg> | null = null
let revokeUrls: string[] = []

function detectMT(): boolean {
  // core-mt 在视频解码/重编码（x264、palettegen 等多线程路径）存在死锁问题，
  // 音频等单线程路径正常。为可靠性起见固定使用单线程核心。
  // 如需恢复：`return crossOriginIsolated === true`
  return false
}

/** 下载 ffmpeg 核心三件套并转为 blob URL（多 CDN 容错 + Cache 持久化） */
async function fetchCore(
  mt: boolean,
  onProgress: (p: number, received: number, total: number, source: string) => void,
) {
  const pkg = mt ? '@ffmpeg/core-mt' : '@ffmpeg/core'
  const files = mt
    ? ['ffmpeg-core.js', 'ffmpeg-core.wasm', 'ffmpeg-core.worker.js']
    : ['ffmpeg-core.js', 'ffmpeg-core.wasm']

  const bytes: Record<string, Uint8Array> = {}
  let source = ''
  for (let i = 0; i < files.length; i++) {
    const name = files[i]
    const isMain = name === 'ffmpeg-core.wasm'
    const r = await loadEngineBytes({
      cacheId: `${pkg}@${CORE_VERSION}/${name}`,
      urls: npmFileUrls(pkg, CORE_VERSION, `dist/esm/${name}`),
      onProgress: isMain
        ? (p) => onProgress((i + Math.max(0, p.ratio)) / files.length, p.received, p.total, '')
        : undefined,
    })
    source = r.fromCache ? '本地缓存' : r.source ?? source
    onProgress((i + 1) / files.length, 0, 0, source)
    bytes[name] = r.bytes
  }
  return {
    coreURL: bytesToBlobUrl(bytes['ffmpeg-core.js'], 'text/javascript'),
    wasmURL: bytesToBlobUrl(bytes['ffmpeg-core.wasm'], 'application/wasm'),
    workerURL: mt ? bytesToBlobUrl(bytes['ffmpeg-core.worker.js'], 'text/javascript') : undefined,
    source,
  }
}

export const useFfmpeg = create<FfmpegState>((set) => ({
  status: 'idle',
  progress: 0,
  receivedMb: 0,
  totalMb: 0,
  source: '',
  mt: detectMT(),

  load: () => {
    if (loadPromise) return loadPromise
    loadPromise = (async () => {
      let mt = detectMT()
      set({ status: 'loading', progress: 0, error: undefined, mt, source: '' })
      try {
        const ff = await boot(mt, set)
        set({ status: 'ready', progress: 1 })
        return ff
      } catch (e) {
        // 多线程核心不可用时自动回退单线程再试一次
        if (mt) {
          try {
            const ff = await boot(false, set)
            set({ status: 'ready', progress: 1, mt: false })
            return ff
          } catch {
            /* 落到统一报错 */
          }
        }
        console.error('ffmpeg 引擎加载失败', e)
        set({ status: 'error', error: e instanceof Error ? e.message : String(e) })
        loadPromise = null
        throw e
      }
    })()
    return loadPromise
  },

  retry: (): Promise<FFmpeg> => {
    loadPromise = null
    return useFfmpeg.getState().load()
  },
}))

async function boot(
  mt: boolean,
  set: (s: Partial<FfmpegState>) => void,
): Promise<FFmpeg> {
  const ff = new FFmpeg()
  // 记录最近日志，失败时帮助定位编码器/参数问题
  const logs: string[] = []
  ff.on('log', ({ message }) => {
    logs.push(message)
    if (logs.length > 40) logs.shift()
    ;(ff as unknown as { __logs?: string[] }).__logs = logs
  })

  const { coreURL, wasmURL, workerURL, source } = await fetchCore(mt, (p, received, total, src) => {
    set({
      progress: Math.min(0.99, p),
      receivedMb: Number((received / 1048576).toFixed(1)),
      totalMb: Number((total / 1048576).toFixed(1)),
      ...(src ? { source: src } : {}),
    })
  })
  for (const u of revokeUrls) URL.revokeObjectURL(u)
  revokeUrls = [coreURL, wasmURL, ...(workerURL ? [workerURL] : [])]

  await ff.load({ coreURL, wasmURL, classWorkerURL: ffmpegWorkerUrl, workerURL })
  set({ source })
  return ff
}

/** 最近一次 ffmpeg 日志（诊断用） */
export function lastFfmpegLogs(ff: FFmpeg): string {
  return ((ff as unknown as { __logs?: string[] }).__logs ?? []).join('\n')
}

async function fileToBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer())
}

/**
 * 执行一条 ffmpeg 命令：写入输入文件 → exec → 读出输出并包装为 Blob。
 */
export async function runFFmpeg(
  input: File,
  inputName: string,
  outputName: string,
  args: string[],
  onProgress?: (p: number) => void,
  mime?: string,
): Promise<Blob> {
  const ff = await useFfmpeg.getState().load()
  await ff.writeFile(inputName, await fileToBytes(input))
  const handler = ({ progress }: { progress: number }) => onProgress?.(Math.max(0, Math.min(1, progress)))
  ff.on('progress', handler)
  try {
    const code = await ff.exec(args)
    if (code !== 0) {
      const tail = lastFfmpegLogs(ff).split('\n').slice(-6).join('\n')
      throw new Error(`转换失败（ffmpeg 退出码 ${code}）。${tail ? `日志末尾：\n${tail}` : ''}`)
    }
    const data = await ff.readFile(outputName)
    if (!(data instanceof Uint8Array) || data.length === 0) {
      throw new Error('转换失败：输出为空，可能是编码器不支持当前参数或源文件损坏')
    }
    const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
    return new Blob([buf], { type: mime ?? 'application/octet-stream' })
  } finally {
    ff.off('progress', handler)
    try {
      await ff.deleteFile(inputName)
    } catch {
      /* 忽略清理错误 */
    }
    try {
      await ff.deleteFile(outputName)
    } catch {
      /* 忽略清理错误 */
    }
  }
}
