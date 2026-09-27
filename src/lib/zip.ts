import { zip } from 'fflate'
import { downloadBlob } from '@/lib/utils'
import type { ResultFile } from '@/config/types'

export async function zipResults(files: ResultFile[], zipName: string): Promise<void> {
  const entries: Record<string, Uint8Array> = {}
  const used = new Set<string>()
  for (const f of files) {
    let name = f.name
    let i = 1
    while (used.has(name)) {
      const dot = f.name.lastIndexOf('.')
      name = dot > 0 ? `${f.name.slice(0, dot)}-${i++}${f.name.slice(dot)}` : `${f.name}-${i++}`
    }
    used.add(name)
    entries[name] = new Uint8Array(await f.blob.arrayBuffer())
  }
  const packed = await new Promise<Uint8Array>((resolve, reject) =>
    zip(entries, { level: 3 }, (err, data) => (err ? reject(err) : resolve(data))),
  )
  downloadBlob(
    new Blob([packed as unknown as BlobPart], { type: 'application/zip' }),
    zipName,
  )
}
