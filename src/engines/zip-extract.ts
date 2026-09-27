import { unzip } from 'fflate'
import type { ConverterModule, ResultFile } from '@/config/types'
import { baseName } from '@/lib/utils'

const MAX_ENTRIES = 2000
const MAX_TOTAL = 500 * 1024 * 1024 // 500 MB
const MAX_ENTRY = 200 * 1024 * 1024 // 单条目上限

/** ZIP 解压：纯本地解包，逐条目导出（可打包下载还原目录结构） */
export const zipExtract: ConverterModule = {
  fields: [
    {
      key: 'flatten',
      label: '扁平化文件名',
      type: 'toggle',
      default: false,
      hint: '关闭时保留子目录路径（打包下载可还原结构）',
    },
  ],
  async run([file], s, ctx) {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const entries = await new Promise<Record<string, Uint8Array>>((resolve, reject) =>
      unzip(
        bytes,
        { filter: (f) => f.originalSize <= MAX_ENTRY },
        (err, data) => (err ? reject(new Error(`解压失败：${err.message}`)) : resolve(data)),
      ),
    )

    const names = Object.keys(entries).filter((n) => !n.endsWith('/') && !n.startsWith('__MACOSX/'))
    if (!names.length) throw new Error('压缩包中没有可用文件')
    if (names.length > MAX_ENTRIES) throw new Error(`压缩包含 ${names.length} 个文件，超出处理上限（${MAX_ENTRIES}）`)

    const base = baseName(file.name)
    const flatten = Boolean(s.flatten)
    const results: ResultFile[] = []
    let total = 0
    for (let i = 0; i < names.length; i++) {
      const raw = names[i]
      // 路径安全：拒绝绝对路径与目录穿越
      const safe = raw.replace(/^[/\\]+/, '').replace(/\\/g, '/')
      if (!safe || safe.split('/').some((seg) => seg === '..')) continue
      const data = entries[raw]
      total += data.length
      if (total > MAX_TOTAL) throw new Error('解压后总体积超过 500 MB，已中止')
      const outName = flatten ? `${base}-${safe.replaceAll('/', '-')}` : safe
      results.push({
        name: outName,
        blob: new Blob([data as unknown as BlobPart], { type: 'application/octet-stream' }),
      })
      ctx.onProgress(((i + 1) / names.length) * 0.95)
    }
    if (!results.length) throw new Error('压缩包中没有可安全解压的文件')
    ctx.onProgress(1)
    return results
  },
}
