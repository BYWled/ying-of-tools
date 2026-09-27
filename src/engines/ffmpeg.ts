import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import { create } from 'zustand'
// 由 Vite 打包的 worker（scripts/copy-ffmpeg.mjs 生成到 src/vendor，解析其相对导入）
import ffmpegWorkerUrl from '@/vendor/ffmpeg-worker/worker.js?worker&url'

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'error'

interface FfmpegState {
  status: EngineStatus
  /** 0~1 引擎 wasm 下载进度 */
  progress: number
  error?: string
  /** true = 使用多线程核心（页面处于跨源隔离状态） */
  mt: boolean
  load: () => Promise<FFmpeg>
}

let loadPromise: Promise<FFmpeg> | null = null

function detectMT(): boolean {
  try {
    return typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated === true
  } catch {
    return false
  }
}

export const useFfmpeg = create<FfmpegState>((set) => ({
  status: 'idle',
  progress: 0,
  mt: detectMT(),

  load: () => {
    if (loadPromise) return loadPromise
    loadPromise = (async () => {
      set({ status: 'loading', progress: 0, error: undefined })
      const mt = detectMT()
      set({ mt })
      try {
        const ff = new FFmpeg()
        // 记录最近日志，失败时帮助定位编码器/参数问题
        const logs: string[] = []
        ff.on('log', ({ message }) => {
          logs.push(message)
          if (logs.length > 40) logs.shift()
          ;(ff as unknown as { __logs?: string[] }).__logs = logs
        })

        const base = mt ? '/ffmpeg/mt' : '/ffmpeg/st'
        const [coreURL, wasmURL] = await Promise.all([
          toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
          toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm', true, (e) => {
            set({ progress: Math.min(0.98, 0.05 + (e.received / Math.max(1, e.total)) * 0.93) })
          }),
        ])
        const workerURL = mt
          ? await toBlobURL(`${base}/ffmpeg-core.worker.js`, 'text/javascript')
          : undefined

        await ff.load({ coreURL, wasmURL, classWorkerURL: ffmpegWorkerUrl, workerURL })
        set({ status: 'ready', progress: 1 })
        return ff
      } catch (e) {
        console.error('ffmpeg 引擎加载失败', e)
        set({ status: 'error', error: e instanceof Error ? e.message : String(e) })
        loadPromise = null
        throw e
      }
    })()
    return loadPromise
  },
}))

/** 最近一次 ffmpeg 日志（诊断用） */
export function lastFfmpegLogs(ff: FFmpeg): string {
  return ((ff as unknown as { __logs?: string[] }).__logs ?? []).join('\n')
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
  await ff.writeFile(inputName, await fetchFile(input))
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
