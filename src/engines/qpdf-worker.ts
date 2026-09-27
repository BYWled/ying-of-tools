import createQpdfModule from '@neslinesli93/qpdf-wasm'
import qpdfWasmUrl from '@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url'

/**
 * QPDF WASM 专用 Worker：WORKERFS 依赖 FileReaderSync（仅 Worker 可用），
 * 主线程挂载 Blob 会直接 abort，因此加密/解密/修复必须在此执行。
 */
interface QpdfRequest {
  id: number
  bytes: ArrayBuffer
  args: string[]
}

interface QpdfResponse {
  id: number
  ok: boolean
  bytes?: ArrayBuffer
  error?: string
}

async function runOne(bytes: ArrayBuffer, args: string[]): Promise<ArrayBuffer> {
  // 每次请求使用全新模块实例：Emscripten abort 后模块不可复用（wasm 编译有浏览器缓存，代价小）
  const mod = await createQpdfModule({
    locateFile: () => qpdfWasmUrl,
    noInitialRun: true,
  } as Parameters<typeof createQpdfModule>[0])
  try {
    mod.FS.mkdir('/in')
  } catch {
    /* 已存在 */
  }
  try {
    mod.FS.mkdir('/out')
  } catch {
    /* 已存在 */
  }
  const file = new File([bytes], 'input.pdf', { type: 'application/pdf' })
  mod.FS.mount(mod.WORKERFS, { blobs: [{ name: 'input.pdf', data: file }] }, '/in')
  try {
    const code = mod.callMain([...args, '/out/result.pdf'])
    if (code !== 0 && code !== undefined) {
      throw new Error(`QPDF 处理失败（退出码 ${code}），请检查密码是否正确或文件是否损坏`)
    }
    const data = mod.FS.readFile('/out/result.pdf') as Uint8Array
    if (!data || data.length === 0) throw new Error('QPDF 未产出结果文件')
    return data.slice().buffer as ArrayBuffer
  } finally {
    try {
      mod.FS.unmount('/in')
    } catch {
      /* 忽略 */
    }
  }
}

self.addEventListener('message', async (e: MessageEvent<QpdfRequest>) => {
  const { id, bytes, args } = e.data
  const post = (self as unknown as { postMessage: (m: QpdfResponse, t?: ArrayBuffer[]) => void }).postMessage.bind(self)
  try {
    const out = await runOne(bytes, args)
    post({ id, ok: true, bytes: out }, [out])
  } catch (err) {
    post({ id, ok: false, error: err instanceof Error ? err.message : String(err) })
  }
})
