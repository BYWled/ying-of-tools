/**
 * 大体积引擎资源（ffmpeg core 等）统一加载器：
 * - 多 CDN 顺序容错（jsdelivr 各节点 + unpkg），单个源失败自动换下一个
 * - 流式读取 Response.body 报告进度，绝不重复消费 body（修复线上
 *   `body stream already read` 导致引擎必挂的问题）
 * - Cache API 持久缓存：首次成功后写入 Cache Storage，之后秒开且不再依赖 CDN
 */

export interface DownloadProgress {
  received: number
  total: number
  /** 0~1，total 未知时为 -1 */
  ratio: number
}

type ProgressCb = (p: DownloadProgress) => void

/** 生成同一个 npm 文件在多个 CDN 上的候选地址（顺序即优先级） */
export function npmFileUrls(pkg: string, version: string, file: string): string[] {
  const clean = file.replace(/^\//, '')
  return [
    `https://fastly.jsdelivr.net/npm/${pkg}@${version}/${clean}`,
    `https://testingcf.jsdelivr.net/npm/${pkg}@${version}/${clean}`,
    `https://cdn.jsdelivr.net/npm/${pkg}@${version}/${clean}`,
    `https://unpkg.com/${pkg}@${version}/${clean}`,
  ]
}

/** 流式下载单个 URL（单次消费 body），失败抛错由上层换源 */
async function fetchOne(url: string, onProgress?: ProgressCb): Promise<Uint8Array> {
  const res = await fetch(url, { mode: 'cors', redirect: 'follow' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const total = Number(res.headers.get('content-length')) || 0

  if (!res.body) {
    const buf = await res.arrayBuffer()
    return new Uint8Array(buf)
  }

  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.byteLength
    onProgress?.({ received, total, ratio: total > 0 ? received / total : -1 })
  }
  const out = new Uint8Array(received)
  let off = 0
  for (const c of chunks) {
    out.set(c, off)
    off += c.byteLength
  }
  return out
}

const CACHE_NAME = 'ying-tools-engines-v1'

function cacheKey(id: string): Request {
  return new Request(`https://engine-cache.local/${id}`)
}

async function readCache(id: string): Promise<Uint8Array | null> {
  try {
    if (!('caches' in self)) return null
    const cache = await caches.open(CACHE_NAME)
    const hit = await cache.match(cacheKey(id))
    if (!hit) return null
    return new Uint8Array(await hit.arrayBuffer())
  } catch {
    return null
  }
}

async function writeCache(id: string, bytes: Uint8Array): Promise<void> {
  try {
    if (!('caches' in self)) return
    const cache = await caches.open(CACHE_NAME)
    await cache.put(cacheKey(id), new Response(bytes.buffer.slice(0) as ArrayBuffer, {
      headers: { 'content-type': 'application/octet-stream' },
    }))
  } catch {
    /* 隐私模式等场景缓存不可用，忽略 */
  }
}

export interface LoadOptions {
  /** 缓存标识（同时也是 Cache Storage 的键） */
  cacheId: string
  /** 候选地址，按优先级排列 */
  urls: string[]
  onProgress?: ProgressCb
}

export interface LoadResult {
  bytes: Uint8Array
  /** 命中本地持久缓存（无需联网） */
  fromCache: boolean
  /** 实际使用的源地址；缓存命中时为空 */
  source?: string
}

/** 带持久缓存 + 多源容错的下载入口 */
export async function loadEngineBytes({ cacheId, urls, onProgress }: LoadOptions): Promise<LoadResult> {
  const cached = await readCache(cacheId)
  if (cached && cached.byteLength > 0) {
    onProgress?.({ received: cached.byteLength, total: cached.byteLength, ratio: 1 })
    return { bytes: cached, fromCache: true }
  }

  const errors: string[] = []
  for (const url of urls) {
    try {
      const bytes = await fetchOne(url, onProgress)
      if (bytes.byteLength === 0) throw new Error('空响应')
      await writeCache(cacheId, bytes)
      return { bytes, fromCache: false, source: new URL(url).host }
    } catch (e) {
      errors.push(`${new URL(url).host}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  throw new Error(`所有下载源均失败。${errors.join('；')}`)
}

/** 字节 → blob URL（供 ffmpeg core / wasm 注入 worker） */
export function bytesToBlobUrl(bytes: Uint8Array, mime: string): string {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return URL.createObjectURL(new Blob([copy.buffer], { type: mime }))
}
